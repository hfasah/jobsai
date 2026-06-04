import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { extractInterviewEvent } from "@/lib/ai-content";
import { createCalendarEvent } from "@/lib/google-calendar";

// POST /api/inbox/[id]/schedule — detect an interview time in the email and add
// it to the user's Google Calendar.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data: msg } = await supabaseAdmin
    .from("inbox_messages")
    .select("subject, body_text, from_email, from_name")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: "Message not found." }, { status: 404 });

  let ev;
  try {
    ev = await extractInterviewEvent(msg.subject ?? "", msg.body_text ?? "", new Date().toISOString());
  } catch (err) {
    console.error("extractInterviewEvent error:", err);
    return NextResponse.json({ error: "Could not read the email." }, { status: 500 });
  }

  if (!ev.found || !ev.startISO) {
    return NextResponse.json({ data: { found: false } });
  }

  const end = ev.endISO ?? new Date(new Date(ev.startISO).getTime() + 45 * 60_000).toISOString();
  const description = [
    msg.from_name || msg.from_email ? `With: ${msg.from_name || msg.from_email}` : null,
    ev.notes,
    "Added by JobsAI from your inbox.",
  ].filter(Boolean).join("\n\n");

  const result = await createCalendarEvent(userId, {
    summary: ev.summary || `Interview — ${msg.from_name || "recruiter"}`,
    description,
    location: ev.location,
    startISO: ev.startISO,
    endISO: end,
    timeZone: ev.timeZone,
  });

  if (!result.ok) return NextResponse.json({ error: result.error ?? "Calendar add failed." }, { status: 502 });
  return NextResponse.json({ data: { found: true, htmlLink: result.htmlLink, when: ev.startISO } });
}
