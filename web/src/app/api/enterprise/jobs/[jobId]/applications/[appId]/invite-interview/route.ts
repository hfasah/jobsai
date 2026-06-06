import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { resend } from "@/lib/resend";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

type Ctx = { params: Promise<{ jobId: string; appId: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId, appId } = await params;

  // Ensure interview kit exists
  const { data: kit } = await supabaseAdmin
    .from("enterprise_interview_kits")
    .select("id")
    .eq("job_id", jobId).maybeSingle();

  if (!kit) return NextResponse.json({ error: "Generate an interview kit first." }, { status: 400 });

  const { data: app } = await supabaseAdmin
    .from("enterprise_applications")
    .select("*, job:enterprise_jobs(title)")
    .eq("id", appId).eq("org_id", org.id).maybeSingle();

  if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  // Create or return existing interview
  const { data: existing } = await supabaseAdmin
    .from("enterprise_interviews")
    .select("*")
    .eq("application_id", appId).maybeSingle();

  if (existing && existing.status !== "expired") {
    return NextResponse.json({ data: existing });
  }

  const { data: interview, error } = await supabaseAdmin
    .from("enterprise_interviews")
    .insert({ application_id: appId, job_id: jobId, org_id: org.id })
    .select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const jobTitle = (app.job as { title: string } | null)?.title ?? "the role";
  const interviewUrl = `${APP_URL}/enterprise/interview/${interview.token}`;

  await resend.emails.send({
    from: `${org.name} Recruiting <support@jobsai.work>`,
    to: app.candidate_email,
    subject: `Interview invitation — ${jobTitle} at ${org.name}`,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#2563eb">You're invited to interview!</h2>
      <p>Hi ${app.candidate_name},</p>
      <p>Congratulations — we'd like to move forward with your application for <strong>${jobTitle}</strong> at ${org.name}.</p>
      <p>Please complete your interview at your convenience before the link expires in 7 days.</p>
      <div style="margin:24px 0">
        <a href="${interviewUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Start your interview →
        </a>
      </div>
      <p style="color:#888;font-size:13px">This link is unique to you and expires in 7 days. Complete it at your own pace.</p>
    </div>`,
  }).catch(console.error);

  // Move to interview stage
  await supabaseAdmin
    .from("enterprise_applications")
    .update({ stage: "interview", stage_updated_at: new Date().toISOString() })
    .eq("id", appId);

  return NextResponse.json({ data: interview, interviewUrl }, { status: 201 });
}
