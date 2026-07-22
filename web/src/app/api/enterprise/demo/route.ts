import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resend, FROM_SUPPORT, SUPPORT_EMAIL } from "@/lib/resend";
import { createRateLimiter, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { buildIcs } from "@/lib/ics";

export const maxDuration = 20;

const limiter = createRateLimiter({ limit: 8, windowMs: 10 * 60_000 });

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work").replace(/\/$/, "");
// Where demo requests are emailed. Defaults to the monitored support inbox.
const NOTIFY_EMAIL = process.env.DEMO_NOTIFY_EMAIL ?? SUPPORT_EMAIL;
const DURATION_MIN = 30;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// POST /api/enterprise/demo — public: book a personalized demo slot.
// body: { name, email, company?, phone?, team_size?, current_ats?, goals?,
//         starts_at (ISO), timezone?, source? }
export async function POST(req: NextRequest) {
  const rl = limiter(getClientIp(req));
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const b = await req.json().catch(() => ({}));
  const name = (b.name as string | undefined)?.trim();
  const email = (b.email as string | undefined)?.trim().toLowerCase();
  const startsRaw = (b.starts_at as string | undefined)?.trim();

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid work email." }, { status: 400 });
  }
  if (!startsRaw) {
    return NextResponse.json({ error: "Pick a date and time." }, { status: 400 });
  }
  const startsAt = new Date(startsRaw);
  if (Number.isNaN(startsAt.getTime())) {
    return NextResponse.json({ error: "Invalid time slot." }, { status: 400 });
  }
  if (startsAt.getTime() < Date.now() + 60_000) {
    return NextResponse.json({ error: "Pick a time in the future." }, { status: 400 });
  }

  const company = (b.company as string | undefined)?.trim() || null;
  const phone = (b.phone as string | undefined)?.trim() || null;
  const teamSize = (b.team_size as string | undefined)?.trim() || null;
  const currentAts = (b.current_ats as string | undefined)?.trim() || null;
  const goals = (b.goals as string | undefined)?.trim() || null;
  const timezone = (b.timezone as string | undefined)?.trim() || null;
  const source = (b.source as string | undefined)?.trim() || null;

  const { data: row, error } = await supabaseAdmin
    .from("enterprise_demo_bookings")
    .insert({
      name, email, company, phone,
      team_size: teamSize,
      current_ats: currentAts,
      goals,
      starts_at: startsAt.toISOString(),
      duration_min: DURATION_MIN,
      timezone,
      source,
      status: "requested",
    })
    .select("id")
    .single();

  if (error || !row) {
    console.error("enterprise_demo_bookings insert error", error);
    return NextResponse.json({ error: "Could not book your demo. Please try again." }, { status: 500 });
  }

  const firstName = name.split(/\s+/)[0];
  const whenLong = startsAt.toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
    ...(timezone ? { timeZone: timezone } : {}),
  });

  const ics = buildIcs({
    uid: `demo-${row.id}@jobsai.work`,
    title: "JobsAI Enterprise — Personalized Demo",
    description: `Your 30-minute walkthrough of JobsAI Enterprise${company ? ` for ${company}` : ""}. Booking reference: ${row.id}`,
    start: startsAt,
    durationMin: DURATION_MIN,
    organizerName: "JobsAI Enterprise",
    organizerEmail: "noreply@jobsai.work",
    attendees: [{ name, email }],
    status: "TENTATIVE",
  });

  // Notify the back office (best-effort).
  resend.emails.send({
    from: FROM_SUPPORT,
    to: NOTIFY_EMAIL,
    replyTo: email,
    subject: `New demo request — ${company ?? name} (${whenLong})`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#4338ca">New demo request</h2>
        <p><strong>${esc(name)}</strong> &lt;${esc(email)}&gt;${phone ? ` · ${esc(phone)}` : ""}</p>
        ${company ? `<p>Company: <strong>${esc(company)}</strong></p>` : ""}
        <p>When: <strong>${whenLong}</strong> (${DURATION_MIN} min)${timezone ? ` · ${esc(timezone)}` : ""}</p>
        ${teamSize ? `<p>Recruiter team size: ${esc(teamSize)}</p>` : ""}
        ${currentAts ? `<p>Current ATS / tools: ${esc(currentAts)}</p>` : ""}
        ${goals ? `<p>Goals: ${esc(goals)}</p>` : ""}
        <p><a href="${APP_URL}/admin/enterprise/intake" style="color:#4338ca">Open the back office →</a></p>
      </div>`,
  }).then(() => {}, (e) => console.error("demo notify email", e));

  // Confirm to the prospect with a calendar invite (best-effort).
  resend.emails.send({
    from: "JobsAI Enterprise <noreply@jobsai.work>",
    to: email,
    replyTo: NOTIFY_EMAIL,
    subject: `Your JobsAI Enterprise demo — ${whenLong}`,
    attachments: [{ filename: "demo.ics", content: Buffer.from(ics).toString("base64") }],
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#0f172a;font-size:15px;line-height:1.6">
        <h2 style="color:#4338ca">You're booked, ${esc(firstName)} 🎉</h2>
        <p>Thanks for booking a personalized walkthrough of <strong>JobsAI Enterprise</strong>. Here are the details:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:6px 0;color:#666;width:120px">Date &amp; time</td><td style="padding:6px 0;font-weight:600">${whenLong}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Duration</td><td style="padding:6px 0;font-weight:600">${DURATION_MIN} minutes</td></tr>
        </table>
        <p style="color:#666;font-size:13px">A calendar invite is attached — add it to get a reminder. We'll send the meeting link before the call.${goals ? ` We'll tailor the demo to: ${esc(goals)}.` : ""}</p>
        <p>Talk soon,<br/>The JobsAI Enterprise team</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
        <p style="color:#9ca3af;font-size:12px"><a href="${APP_URL}" style="color:#4338ca">app.jobsai.work</a></p>
      </div>`,
  }).then(() => {}, (e) => console.error("demo confirm email", e));

  return NextResponse.json({ ok: true, id: row.id, starts_at: startsAt.toISOString() });
}
