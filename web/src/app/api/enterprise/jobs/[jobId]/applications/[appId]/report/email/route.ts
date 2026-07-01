import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, enterpriseSenderEmail } from "@/lib/enterprise";
import { emailFromName } from "@/lib/email-utils";
import { intakeAddress } from "@/lib/enterprise-intake-inbox";
import { resend } from "@/lib/resend";
import { buildInterviewReportHtml, reportFilename } from "@/lib/interview-report-html";
import type { InterviewReport } from "@/types/interview-intelligence";

export const maxDuration = 30;
type Ctx = { params: Promise<{ jobId: string; appId: string }> };

// POST { report_id, recipients: string[], note? } — email a candidate's
// interview/HR report to hiring managers (or anyone). Sends white-label with a
// .doc attachment, so it's ready to review or forward.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId, appId } = await params;

  const body = await req.json().catch(() => ({}));
  const recipients: string[] = Array.isArray(body.recipients)
    ? body.recipients.map((e: string) => String(e).trim()).filter((e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e))
    : [];
  if (!recipients.length) return NextResponse.json({ error: "Add at least one valid email." }, { status: 400 });
  if (!body.report_id) return NextResponse.json({ error: "report_id required." }, { status: 400 });

  const [{ data: report }, { data: app }, { data: orgData }] = await Promise.all([
    supabaseAdmin.from("enterprise_interview_reports").select("*").eq("id", body.report_id).eq("org_id", org.id).eq("application_id", appId).maybeSingle(),
    supabaseAdmin.from("enterprise_applications").select("candidate_name, candidate_email, job:enterprise_jobs(title)").eq("id", appId).eq("org_id", org.id).maybeSingle(),
    supabaseAdmin.from("enterprise_orgs").select("name, white_label_email_from, slug, intake_email_handle").eq("id", org.id).maybeSingle(),
  ]);
  if (!report || !app) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  const orgName = orgData?.name ?? org.name;
  const jobTitle = (app.job as { title?: string } | null)?.title ?? null;
  const html = buildInterviewReportHtml({
    report: report as InterviewReport,
    candidateName: app.candidate_name as string,
    candidateEmail: app.candidate_email as string | null,
    jobTitle,
    orgName,
  });

  const fromName = emailFromName(orgName, orgData?.white_label_email_from ?? null);
  const intake = orgData?.slug ? intakeAddress({ slug: orgData.slug, intake_email_handle: orgData.intake_email_handle }) : null;
  const replyTo = intake ? `${orgName} <${intake}>` : undefined;
  const note = (body.note as string | undefined)?.trim();
  const candidate = app.candidate_name as string;

  const emailBody = `<div style="font-family:sans-serif;max-width:640px;margin:0 auto;color:#0f172a">
    <p>Hi,</p>
    <p><strong>${candidate}</strong>'s interview report${jobTitle ? ` for <strong>${jobTitle}</strong>` : ""} is below (also attached as a document you can save or forward).</p>
    ${note ? `<p style="padding:10px 14px;background:#f4f4f5;border-radius:8px;white-space:pre-wrap">${note.replace(/</g, "&lt;")}</p>` : ""}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0"/>
    ${html}
  </div>`;

  const { error } = await resend.emails.send({
    from: `${fromName} <${enterpriseSenderEmail(intake)}>`,
    to: recipients,
    ...(replyTo ? { replyTo } : {}),
    subject: `Interview report — ${candidate}${jobTitle ? ` (${jobTitle})` : ""}`,
    html: emailBody,
    attachments: [{ filename: reportFilename(candidate, "doc"), content: Buffer.from(html).toString("base64") }],
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, sent_to: recipients.length });
}
