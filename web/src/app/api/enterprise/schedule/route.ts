import { auth } from "@clerk/nextjs/server";
import { requirePermission } from "@/lib/enterprise-permissions";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { resend } from "@/lib/resend";
import { sendWebhookEvent } from "@/lib/enterprise-webhooks";
import { buildIcs } from "@/lib/ics";
import { createEnterpriseCalendarEvent } from "@/lib/google-calendar-enterprise";
import { createOutlookCalendarEvent } from "@/lib/microsoft";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const url = new URL(req.url);
  const scope = url.searchParams.get("scope"); // upcoming | all
  let q = supabaseAdmin.from("enterprise_interview_schedule").select("*").eq("org_id", org.id).order("scheduled_at");
  if (scope !== "all") q = q.gte("scheduled_at", new Date(Date.now() - 60 * 60_000).toISOString());

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(userId, "can_schedule_interviews");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  if (!b.candidate_name?.trim() || !b.candidate_email?.trim() || !b.scheduled_at) {
    return NextResponse.json({ error: "Candidate name, email and date/time are required." }, { status: 400 });
  }
  if ((b.interview_type === "video") && !b.meeting_link?.trim()) {
    return NextResponse.json({ error: "Add a meeting link (Zoom / Teams / Google Meet) for a video interview." }, { status: 400 });
  }

  const interviewerEmails: string[] = Array.isArray(b.interviewer_emails)
    ? b.interviewer_emails.filter((e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) : [];

  const { data: row, error } = await supabaseAdmin.from("enterprise_interview_schedule").insert({
    org_id: org.id, job_id: b.job_id ?? null, application_id: b.application_id ?? null,
    candidate_name: b.candidate_name.trim(), candidate_email: b.candidate_email.trim().toLowerCase(),
    title: b.title?.trim() || `Interview — ${b.candidate_name.trim()}`,
    interview_type: b.interview_type ?? "video",
    provider: b.provider ?? null, meeting_link: b.meeting_link ?? null, location: b.location ?? null,
    scheduled_at: b.scheduled_at, duration_min: b.duration_min ?? 45,
    interviewers: b.interviewers ?? null, interviewer_emails: interviewerEmails,
    notes: b.notes ?? null, created_by: userId, status: "scheduled",
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sendInterviewInvite(org.name, row);

  // Add to recruiter's calendar (Google or Microsoft — fire-and-forget)
  const endISO = new Date(
    new Date(row.scheduled_at).getTime() + (row.duration_min ?? 45) * 60_000
  ).toISOString();
  const calEvent = {
    summary: row.title,
    subject: row.title,
    startISO: row.scheduled_at,
    endISO,
    location: (row.meeting_link ?? row.location) || null,
    attendees: [{ email: row.candidate_email, name: row.candidate_name }],
  };
  createEnterpriseCalendarEvent(userId, calEvent).catch(() => {});
  createOutlookCalendarEvent(userId, calEvent).catch(() => {});

  sendWebhookEvent(org.id, "interview.scheduled", {
    interview_id: row.id,
    candidate_name: row.candidate_name,
    candidate_email: row.candidate_email,
    scheduled_at: row.scheduled_at,
    duration_min: row.duration_min,
    interview_type: row.interview_type,
    job_id: row.job_id ?? null,
  }).catch(() => {});

  return NextResponse.json({ data: row }, { status: 201 });
}

// Shared: send the candidate + interviewers a calendar invite with the meeting link
export async function sendInterviewInvite(orgName: string, row: Record<string, unknown>) {
  const start = new Date(row.scheduled_at as string);
  const link = (row.meeting_link as string) || (row.location as string) || "";
  const confirmUrl = `${APP_URL}/enterprise/confirm/${row.confirm_token}`;
  const when = start.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

  const ics = buildIcs({
    uid: `${row.id}@jobsai.work`,
    title: row.title as string,
    description: `Interview with ${orgName}.${link ? `\n\nJoin: ${link}` : ""}${row.notes ? `\n\n${row.notes}` : ""}\n\nConfirm: ${confirmUrl}`,
    location: link || (row.location as string) || undefined,
    url: (row.meeting_link as string) || undefined,
    start, durationMin: (row.duration_min as number) ?? 45,
    organizerName: `${orgName} Recruiting`, organizerEmail: "support@jobsai.work",
    attendees: [{ name: row.candidate_name as string, email: row.candidate_email as string },
      ...((row.interviewer_emails as string[]) ?? []).map((e) => ({ email: e }))],
  });
  const attachment = { filename: "interview.ics", content: Buffer.from(ics, "utf-8") };

  const joinBtn = link
    ? `<div style="margin:20px 0"><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Join the meeting →</a></div>`
    : "";

  // Candidate email — with confirm CTA
  await resend.emails.send({
    from: `${orgName} Recruiting <support@jobsai.work>`,
    to: row.candidate_email as string,
    subject: `Interview scheduled — ${row.title}`,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
      <h2 style="color:#2563eb">Your interview is scheduled</h2>
      <p>Hi ${row.candidate_name},</p>
      <p>Your interview with <strong>${orgName}</strong> is booked for:</p>
      <p style="font-size:16px;font-weight:600">${when}</p>
      ${link ? `<p>${(row.interview_type) === "onsite" ? "Location" : "Meeting link"}: <a href="${link}">${link}</a></p>` : ""}
      ${joinBtn}
      <p>Please confirm so we know you're coming:</p>
      <div style="margin:8px 0"><a href="${confirmUrl}" style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Confirm attendance</a></div>
      <p style="color:#888;font-size:13px">A calendar invite is attached. You'll get reminders before the interview.</p>
    </div>`,
    attachments: [attachment],
  }).catch(console.error);

  // Interviewers
  const emails = (row.interviewer_emails as string[]) ?? [];
  if (emails.length) {
    await resend.emails.send({
      from: `${orgName} Recruiting <support@jobsai.work>`,
      to: emails,
      subject: `Interview with ${row.candidate_name} — ${when}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <h2 style="color:#2563eb">Interview scheduled</h2>
        <p>You're interviewing <strong>${row.candidate_name}</strong>.</p>
        <p style="font-size:16px;font-weight:600">${when}</p>
        ${joinBtn}
        ${row.notes ? `<p style="color:#555">${row.notes}</p>` : ""}
        <p style="color:#888;font-size:13px">Calendar invite attached.</p>
      </div>`,
      attachments: [attachment],
    }).catch(console.error);
  }
}
