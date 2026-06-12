import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { resend } from "@/lib/resend";
import type { AppStage } from "@/types/enterprise";
import { sendWebhookEvent } from "@/lib/enterprise-webhooks";
import { sendFromRecruiterGmail } from "@/lib/recruiter-gmail";
import { runWorkflows } from "@/lib/workflow-engine";
import { wrapEmail, emailFromName } from "@/lib/email-utils";
import { runPipelineAgent } from "@/lib/pipeline-agent";

type Ctx = { params: Promise<{ jobId: string; appId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { appId } = await params;

  const { data, error } = await supabaseAdmin
    .from("enterprise_applications")
    .select("*")
    .eq("id", appId)
    .eq("org_id", org.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Application not found." }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { appId, jobId } = await params;
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  if (body.stage !== undefined) {
    update.stage = body.stage;
    update.stage_updated_at = new Date().toISOString();
  }
  if (body.tags !== undefined) update.tags = body.tags;
  if (body.notes !== undefined) update.notes = body.notes;

  const { data, error } = await supabaseAdmin
    .from("enterprise_applications")
    .update(update)
    .eq("id", appId)
    .eq("org_id", org.id)
    .select("*, job:enterprise_jobs(title)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Send stage-change email if stage moved
  if (body.stage && body.send_email !== false) {
    const orgData = org as unknown as Record<string, unknown>;
    await sendStageEmail(data, body.stage as AppStage, userId, org.name, {
      showPoweredBy: (orgData.show_powered_by as boolean) ?? true,
      emailFrom: orgData.white_label_email_from as string | null,
    });
  }

  if (body.stage) {
    const event = body.stage === "hired" ? "application.hired" : "application.stage_changed";
    sendWebhookEvent(org.id, event, {
      application_id: appId,
      job_id: jobId,
      candidate_name: data.candidate_name,
      candidate_email: data.candidate_email,
      stage: body.stage,
    }).catch(() => {});

    const jobTitle = (data.job as { title: string } | null)?.title ?? "";
    const orgData2 = org as unknown as Record<string, unknown>;
    runWorkflows("stage_change", {
      org_id: org.id,
      org_name: org.name,
      application_id: appId,
      job_id: jobId,
      job_title: jobTitle,
      candidate_name: data.candidate_name as string,
      candidate_email: data.candidate_email as string,
      stage: body.stage,
      recruiter_id: userId,
      show_powered_by: (orgData2.show_powered_by as boolean) ?? true,
      email_from_name: orgData2.white_label_email_from as string | null,
    }, body.stage).catch(() => {});
  }

  if (body.stage) {
    void runPipelineAgent(
      {
        id: appId,
        org_id: org.id,
        job_id: jobId,
        candidate_name: data.candidate_name as string,
        candidate_email: data.candidate_email as string,
        stage: body.stage as string,
        match_score: data.match_score as number | null,
        ats_score: data.ats_score as number | null,
        ai_recommendation: data.ai_recommendation as string | null,
        risk_flags: data.risk_flags as string[] | null,
        ats_keywords_matched: data.ats_keywords_matched as string[] | null,
        ats_keywords_missing: data.ats_keywords_missing as string[] | null,
      },
      (data.job as { title: string } | null)?.title ?? "",
      "stage_changed",
    );
  }

  return NextResponse.json({ data });
}

async function sendStageEmail(
  app: Record<string, unknown>,
  stage: AppStage,
  recruiterId: string,
  orgName = "the company",
  opts: { showPoweredBy?: boolean; emailFrom?: string | null } = {},
) {
  const jobTitle = (app.job as { title: string } | null)?.title ?? "the role";
  const name = app.candidate_name as string;
  const email = app.candidate_email as string;

  const subjects: Partial<Record<AppStage, string>> = {
    interview: `Interview invitation — ${jobTitle}`,
    offer:     `Exciting news about your application — ${jobTitle}`,
    hired:     `Congratulations! Offer extended — ${jobTitle}`,
    rejected:  `Your application update — ${jobTitle}`,
  };

  const bodies: Partial<Record<AppStage, string>> = {
    interview: `<p>Great news! We'd like to invite you to interview for <strong>${jobTitle}</strong>. Our team will be in touch shortly with scheduling details.</p>`,
    offer:     `<p>We're pleased to let you know that we'd like to move forward with an offer for <strong>${jobTitle}</strong>. Our team will be reaching out with the details shortly.</p>`,
    hired:     `<p>Congratulations! We're thrilled to welcome you to the team. Our team will be in touch with next steps for onboarding.</p>`,
    rejected:  `<p>Thank you for your interest in <strong>${jobTitle}</strong> and for taking the time to apply. After careful consideration, we've decided to move forward with other candidates at this time. We appreciate your interest and encourage you to apply for future openings.</p>`,
  };

  const subject = subjects[stage];
  const bodyHtml = bodies[stage];
  if (!subject || !bodyHtml) return;

  const fullHtml = wrapEmail(
    `<h2 style="color:#2563eb">Application Update</h2><p>Hi ${name},</p>${bodyHtml}`,
    opts.showPoweredBy ?? true,
  );

  // Prefer recruiter's connected Gmail; fall back to platform Resend
  const gmailResult = await sendFromRecruiterGmail(recruiterId, {
    to: email, subject, html: fullHtml,
  }).catch(() => ({ ok: false }));

  const fromName = emailFromName(orgName, opts.emailFrom);
  if (!gmailResult.ok) {
    await resend.emails.send({
      from: `${fromName} <support@jobsai.work>`,
      to: email, subject, html: fullHtml,
    }).catch(console.error);
  }
}
