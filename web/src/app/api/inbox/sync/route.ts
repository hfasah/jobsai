import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { syncInbox } from "@/lib/gmail";
import { extractInterviewEvent } from "@/lib/ai-content";
import { createCalendarEvent } from "@/lib/google-calendar";
import { createNotification } from "@/lib/notifications";

// POST /api/inbox/sync — pull recent job-related replies, then auto-add any
// detected interviews to the calendar and notify the user.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await syncInbox(userId);
    let scheduled = 0;

    for (const iv of result.interviews) {
      const who = iv.fromName || iv.fromEmail;
      try {
        const ev = await extractInterviewEvent(iv.subject, iv.body, new Date().toISOString());
        if (ev.found && ev.startISO) {
          const end = ev.endISO ?? new Date(new Date(ev.startISO).getTime() + 45 * 60_000).toISOString();
          const cal = await createCalendarEvent(userId, {
            summary: ev.summary || `Interview — ${who}`,
            description: [`With: ${who}`, ev.notes, "Added by JobsAI from your inbox."].filter(Boolean).join("\n\n"),
            location: ev.location,
            startISO: ev.startISO,
            endISO: end,
            timeZone: ev.timeZone,
          });
          if (cal.ok) scheduled++;
          createNotification(
            userId, "interview", "Interview added to your calendar",
            `${who}: ${ev.summary || "interview"} — ${new Date(ev.startISO).toLocaleString()}`,
            { inbox_id: iv.id, htmlLink: cal.htmlLink }
          ).catch(() => {});
        } else {
          createNotification(
            userId, "interview", "Interview email — pick a time",
            `${who}: ${iv.subject}. Open your inbox to add it to your calendar.`,
            { inbox_id: iv.id }
          ).catch(() => {});
        }
      } catch (err) {
        console.error("auto-schedule error:", err);
      }
    }

    return NextResponse.json({ data: { imported: result.imported, scheduled } });
  } catch (err) {
    console.error("inbox sync error:", err);
    return NextResponse.json({ error: "Sync failed. Reconnect your mailbox and try again." }, { status: 502 });
  }
}
