import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { resend } from "@/lib/resend";
import { sendInterviewInvite } from "../route";

type Ctx = { params: Promise<{ id: string }> };

// PUT — update status, reschedule (resends invite if time/link changed)
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  let resend_invite = false;
  for (const f of ["status", "scheduled_at", "meeting_link", "duration_min", "notes", "interviewers", "interviewer_emails", "location", "provider", "interview_type", "title"]) {
    if (b[f] !== undefined) { update[f] = b[f]; if (["scheduled_at", "meeting_link"].includes(f)) resend_invite = true; }
  }
  if (resend_invite) { update.reminder_24h_sent = false; update.reminder_1h_sent = false; }

  const { data, error } = await supabaseAdmin
    .from("enterprise_interview_schedule").update(update).eq("id", id).eq("org_id", org.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (resend_invite && data.status !== "cancelled") await sendInterviewInvite(org.name, data);
  return NextResponse.json({ data });
}

// DELETE — cancel + notify candidate
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { data: row } = await supabaseAdmin.from("enterprise_interview_schedule").select("*").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Not found." }, { status: 404 });

  await supabaseAdmin.from("enterprise_interview_schedule").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", id);

  await resend.emails.send({
    from: `${org.name} Recruiting <support@jobsai.work>`,
    to: row.candidate_email,
    subject: `Interview cancelled — ${row.title}`,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto"><h2 style="color:#dc2626">Interview cancelled</h2><p>Hi ${row.candidate_name},</p><p>Your interview with ${org.name} has been cancelled. We'll be in touch about rescheduling.</p></div>`,
  }).catch(console.error);

  return NextResponse.json({ ok: true });
}
