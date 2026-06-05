import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { syncInbox, sendReply } from "@/lib/gmail";
import { extractInterviewEvent, draftInboxReply } from "@/lib/ai-content";
import { createCalendarEvent } from "@/lib/google-calendar";
import { createNotification } from "@/lib/notifications";

// POST /api/inbox/sync — pull recent job-related replies, then auto-add any
// detected interviews to the calendar and notify the user. If the user has
// opted into auto-confirm replies, also draft + send replies on their behalf.
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

    const autoReplied = await maybeAutoReply(userId, result.replyable);

    return NextResponse.json({ data: { imported: result.imported, scheduled, autoReplied } });
  } catch (err) {
    console.error("inbox sync error:", err);
    return NextResponse.json({ error: "Sync failed. Reconnect your mailbox and try again." }, { status: 502 });
  }
}

// When auto-confirm reply is enabled, draft + send a reply to each fresh
// interview/update email, sent as the user from their own mailbox.
async function maybeAutoReply(
  userId: string,
  replyable: Awaited<ReturnType<typeof syncInbox>>["replyable"]
): Promise<number> {
  if (!replyable.length) return 0;

  const { data: profile } = await supabaseAdmin
    .from("apply_profiles")
    .select("first_name, last_name, auto_reply")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile?.auto_reply) return 0;

  const { data: acct } = await supabaseAdmin
    .from("email_accounts")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();
  if (!acct?.email) return 0;

  const fromName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  let autoReplied = 0;

  for (const m of replyable) {
    // Don't email into the void — automated senders won't read a reply.
    if (/no-?reply|donotreply|do-not-reply/i.test(m.fromEmail)) continue;
    try {
      const draft = await draftInboxReply(m.subject, m.body, profile.first_name ?? "");
      if (!draft.trim()) continue;

      const subject = m.subject && m.subject.toLowerCase().startsWith("re:") ? m.subject : `Re: ${m.subject ?? ""}`;
      const sent = await sendReply(userId, {
        fromEmail: acct.email, fromName, to: m.fromEmail, subject, text: draft,
        inReplyTo: m.rfcMessageId, threadId: m.threadId,
      });
      if (!sent.ok) continue;

      await supabaseAdmin.from("inbox_messages").insert({
        user_id: userId, direction: "outbound", from_email: acct.email, from_name: fromName || null,
        to_email: m.fromEmail, subject, body_text: draft, classification: "other",
        provider_thread_id: m.threadId ?? null,
      });
      await supabaseAdmin.from("inbox_messages").update({ is_read: true }).eq("id", m.id).eq("user_id", userId);
      autoReplied++;

      createNotification(
        userId, "auto_replied", "JobsAI replied on your behalf",
        `Replied to ${m.fromName || m.fromEmail}: ${m.subject}`,
        { inbox_id: m.id }
      ).catch(() => {});
    } catch (err) {
      console.error("auto-reply error:", err);
    }
  }

  return autoReplied;
}
