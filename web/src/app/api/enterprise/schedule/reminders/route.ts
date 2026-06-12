import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resend } from "@/lib/resend";
import { buildIcs } from "@/lib/ics";

// Called by Vercel Cron: every 30 minutes
// Sends 24h and 1h reminder emails to candidates whose interviews are upcoming

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // 24h window: scheduled_at between now+23h and now+25h
  const window24hStart = new Date(now.getTime() + 23 * 60 * 60_000).toISOString();
  const window24hEnd   = new Date(now.getTime() + 25 * 60 * 60_000).toISOString();

  // 1h window: scheduled_at between now+45min and now+75min
  const window1hStart  = new Date(now.getTime() + 45 * 60_000).toISOString();
  const window1hEnd    = new Date(now.getTime() + 75 * 60_000).toISOString();

  const [{ data: due24h }, { data: due1h }] = await Promise.all([
    supabaseAdmin
      .from("enterprise_interview_schedule")
      .select("*, org:enterprise_orgs!inner(name)")
      .in("status", ["scheduled", "confirmed"])
      .eq("reminder_24h_sent", false)
      .gte("scheduled_at", window24hStart)
      .lte("scheduled_at", window24hEnd),
    supabaseAdmin
      .from("enterprise_interview_schedule")
      .select("*, org:enterprise_orgs!inner(name)")
      .in("status", ["scheduled", "confirmed"])
      .eq("reminder_1h_sent", false)
      .gte("scheduled_at", window1hStart)
      .lte("scheduled_at", window1hEnd),
  ]);

  let sent = 0;

  const sendReminder = async (
    row: Record<string, unknown>,
    window: "24h" | "1h",
  ) => {
    const orgName = (row.org as { name: string } | null)?.name ?? "the company";
    const link = (row.meeting_link as string) || (row.location as string) || "";
    const start = new Date(row.scheduled_at as string);
    const when = start.toLocaleString("en-US", {
      weekday: "long", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    });

    const ics = buildIcs({
      uid: `${row.id}-reminder@jobsai.work`,
      title: row.title as string,
      description: `Interview with ${orgName}.${link ? `\n\nJoin: ${link}` : ""}`,
      location: link || undefined,
      url: (row.meeting_link as string) || undefined,
      start,
      durationMin: (row.duration_min as number) ?? 45,
      organizerName: `${orgName} Recruiting`,
      organizerEmail: "support@jobsai.work",
      attendees: [{ name: row.candidate_name as string, email: row.candidate_email as string }],
    });

    const joinBtn = link
      ? `<div style="margin:16px 0"><a href="${link}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600">Join the meeting →</a></div>`
      : "";

    await resend.emails.send({
      from: `${orgName} Recruiting <support@jobsai.work>`,
      to: row.candidate_email as string,
      subject: `Reminder: Your interview ${window === "24h" ? "tomorrow" : "in 1 hour"} — ${row.title}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <h2 style="color:#2563eb">Interview Reminder</h2>
        <p>Hi ${row.candidate_name},</p>
        <p>Just a reminder that your interview with <strong>${orgName}</strong> is <strong>${window === "24h" ? "tomorrow" : "in about 1 hour"}</strong>.</p>
        <p style="font-size:16px;font-weight:600">${when}</p>
        ${joinBtn}
        <p style="color:#888;font-size:13px">Calendar invite attached for easy access.</p>
      </div>`,
      attachments: [{ filename: "interview.ics", content: Buffer.from(ics, "utf-8") }],
    });

    const field = window === "24h" ? "reminder_24h_sent" : "reminder_1h_sent";
    await supabaseAdmin
      .from("enterprise_interview_schedule")
      .update({ [field]: true })
      .eq("id", row.id as string);

    sent++;
  };

  await Promise.allSettled([
    ...(due24h ?? []).map((r) => sendReminder(r as Record<string, unknown>, "24h")),
    ...(due1h  ?? []).map((r) => sendReminder(r as Record<string, unknown>, "1h")),
  ]);

  return NextResponse.json({ ok: true, sent });
}
