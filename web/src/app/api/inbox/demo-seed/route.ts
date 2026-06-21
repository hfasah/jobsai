import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { classifyEmail } from "@/lib/inbox";

// POST /api/inbox/demo-seed — TEMPORARY.
//
// Inserts a single sample interview email into the CALLER'S OWN inbox so the
// Google OAuth verification demo video can show the "Add to calendar"
// (calendar.events) flow end to end. The email contains an explicit future
// date/time so the schedule route's AI extraction finds it and creates a real
// Google Calendar event. Auth-gated and self-only (writes only to the signed-in
// user's inbox). Remove this route once Google verification is approved.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // A date a few days out so the parsed interview is always in the future.
  const target = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
  const human = target.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });

  const subject = "Interview Invitation — Product Manager at Acme";
  // Worded to hit the classifier's "interview" branch (an explicit invitation),
  // not "confirmation" — so the inbox chip reads "Interview". Avoids
  // "applying"/"your application" phrasing, which would score as application-received.
  const bodyText =
    `Hi,\n\nWe were impressed with your background and would like to invite you ` +
    `to interview for the Product Manager role at Acme. We'd like to schedule ` +
    `your interview for ${human} at 2:00 PM Eastern Time — a 45-minute video ` +
    `call with our hiring panel.\n\nPlease let us know if that time works for ` +
    `you.\n\nBest,\nAcme Recruiting Team`;

  const { data, error } = await supabaseAdmin
    .from("inbox_messages")
    .insert({
      user_id: userId,
      direction: "inbound",
      from_email: "recruiting@acme-careers.com",
      from_name: "Acme Recruiting Team",
      to_email: "demo@apply.jobsai.work",
      subject,
      body_text: bodyText,
      classification: classifyEmail(subject, bodyText),
      received_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    ok: true,
    id: data.id,
    message: "Seeded a sample interview email. Refresh your inbox.",
  });
}
