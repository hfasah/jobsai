import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { resend } from "@/lib/resend";

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;

  const url = new URL(req.url);
  const stage = url.searchParams.get("stage");

  let query = supabaseAdmin
    .from("enterprise_applications")
    .select("*")
    .eq("job_id", jobId)
    .eq("org_id", org.id)
    .order("match_score", { ascending: false, nullsFirst: false });

  if (stage) query = query.eq("stage", stage);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// Public-facing: submit an application (no auth)
export async function POST(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  const { data: job } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("id, org_id, title, status")
    .eq("id", jobId)
    .eq("status", "active")
    .maybeSingle();

  if (!job) return NextResponse.json({ error: "Job not found or no longer accepting applications." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (!body.candidate_name?.trim() || !body.candidate_email?.trim()) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  const email = body.candidate_email.trim().toLowerCase();

  // Duplicate detection: same email + same job
  const { data: existing } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id")
    .eq("job_id", jobId)
    .eq("candidate_email", email)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "You have already applied for this position." }, { status: 409 });

  // Cross-job duplicate: same email + same org
  const { data: prevApp } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id")
    .eq("org_id", job.org_id)
    .eq("candidate_email", email)
    .neq("job_id", jobId)
    .maybeSingle();

  const { data: app, error } = await supabaseAdmin
    .from("enterprise_applications")
    .insert({
      job_id: jobId,
      org_id: job.org_id,
      candidate_name: body.candidate_name.trim(),
      candidate_email: email,
      candidate_phone: body.candidate_phone ?? null,
      cover_letter: body.cover_letter ?? null,
      linkedin_url: body.linkedin_url ?? null,
      portfolio_url: body.portfolio_url ?? null,
      source: body.source ?? "direct",
      duplicate_of: prevApp?.id ?? null,
      is_duplicate: !!prevApp,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Load org name for email
  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("name")
    .eq("id", job.org_id)
    .maybeSingle();

  // Check for custom email template
  const { data: template } = await supabaseAdmin
    .from("enterprise_email_templates")
    .select("subject,body,active")
    .eq("org_id", job.org_id)
    .eq("trigger", "application_received")
    .maybeSingle();

  const orgName = org?.name ?? "the company";
  const vars: Record<string, string> = {
    "{{candidate_name}}": app.candidate_name,
    "{{job_title}}":      job.title,
    "{{org_name}}":       orgName,
  };

  const subject = template?.active && template.subject
    ? Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(k, v), template.subject)
    : `Application received — ${job.title}`;

  const bodyHtml = template?.active && template.body
    ? Object.entries(vars)
        .reduce((s, [k, v]) => s.replaceAll(k, v), template.body)
        .replace(/\n/g, "<br>")
    : `<p>Hi ${app.candidate_name},</p>
       <p>Thank you for applying for <strong>${job.title}</strong> at <strong>${orgName}</strong>. We've received your application and our team will review it carefully. We'll be in touch soon with next steps.</p>
       <p>In the meantime, if you have any questions about the role, feel free to use the chat assistant on the job page.</p>`;

  await resend.emails.send({
    from: `${orgName} Recruiting <support@jobsai.work>`,
    to: app.candidate_email,
    subject,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      ${bodyHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
      <p style="color:#888;font-size:12px">Powered by <a href="https://jobsai.work" style="color:#2563eb">JobsAI Enterprise</a></p>
    </div>`,
  }).catch(console.error);

  await supabaseAdmin
    .from("enterprise_applications")
    .update({ status_email_sent: true })
    .eq("id", app.id);

  // Auto-screen in background if org has auto-screening enabled
  // (fire-and-forget — doesn't block the response)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work"}/api/enterprise/jobs/${jobId}/applications/${app.id}/screen`, {
    method: "POST",
    headers: { "x-internal-auto-screen": "1" },
  }).catch(() => {});

  return NextResponse.json({ data: app }, { status: 201 });
}
