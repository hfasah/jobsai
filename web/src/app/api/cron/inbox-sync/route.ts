import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { syncInbox, sendReply } from "@/lib/gmail";
import { extractInterviewEvent, draftInboxReply } from "@/lib/ai-content";
import { createCalendarEvent } from "@/lib/google-calendar";
import { createNotification } from "@/lib/notifications";

// Allow up to 5 minutes on Vercel Pro (inbox sync + AI drafts can be slow)
export const maxDuration = 300;

// GET /api/cron/inbox-sync — called by Vercel Cron on schedule.
// Runs syncInbox for every user with a connected mailbox, applies
// auto-interview-scheduling and auto-confirm reply for those who've opted in.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: accounts, error } = await supabaseAdmin
    .from("email_accounts")
    .select("user_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = { users_processed: 0, imported: 0, scheduled: 0, auto_replied: 0, errors: 0 };

  for (const acct of accounts ?? []) {
    summary.users_processed++;
    try {
      const result = await syncInbox(acct.user_id);
      summary.imported += result.imported;

      // Auto-add interview emails to calendar
      for (const iv of result.interviews) {
        const who = iv.fromName || iv.fromEmail;
        try {
          const ev = await extractInterviewEvent(iv.subject, iv.body, new Date().toISOString());
          if (ev.found && ev.startISO) {
            const end = ev.endISO ?? new Date(new Date(ev.startISO).getTime() + 45 * 60_000).toISOString();
            const cal = await createCalendarEvent(acct.user_id, {
              summary: ev.summary || `Interview — ${who}`,
              description: [`With: ${who}`, ev.notes, "Added by JobsAI from your inbox."].filter(Boolean).join("\n\n"),
              location: ev.location,
              startISO: ev.startISO,
              endISO: end,
              timeZone: ev.timeZone,
            });
            if (cal.ok) summary.scheduled++;
            createNotification(
              acct.user_id, "interview", "Interview added to your calendar",
              `${who}: ${ev.summary || "interview"} — ${new Date(ev.startISO).toLocaleString()}`,
              { inbox_id: iv.id, htmlLink: cal.htmlLink }
            ).catch(() => {});
          } else {
            createNotification(
              acct.user_id, "interview", "Interview email — pick a time",
              `${who}: ${iv.subject}. Open your inbox to add it to your calendar.`,
              { inbox_id: iv.id }
            ).catch(() => {});
          }
        } catch (err) {
          console.error(`[cron/inbox-sync] interview-schedule error (user ${acct.user_id}):`, err);
        }
      }

      // Auto-confirm reply (opt-in)
      const replied = await maybeAutoReply(acct.user_id, result.replyable);
      summary.auto_replied += replied;
    } catch (err) {
      summary.errors++;
      console.error(`[cron/inbox-sync] sync failed (user ${acct.user_id}):`, err);
    }
  }

  console.log("[cron/inbox-sync]", summary);
  return NextResponse.json({ ok: true, ...summary });
}

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
  let count = 0;

  for (const m of replyable) {
    if (/no-?reply|donotreply|do-not-reply/i.test(m.fromEmail)) continue;
    try {
      const draft = await draftInboxReply(m.subject, m.body, profile.first_name ?? "");
      if (!draft.trim()) continue;

      const subject = m.subject?.toLowerCase().startsWith("re:") ? m.subject : `Re: ${m.subject ?? ""}`;
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
      count++;

      createNotification(
        userId, "auto_replied", "JobsAI replied on your behalf",
        `Replied to ${m.fromName || m.fromEmail}: ${m.subject}`,
        { inbox_id: m.id }
      ).catch(() => {});
    } catch (err) {
      console.error(`[cron/inbox-sync] auto-reply error (user ${userId}):`, err);
    }
  }

  return count;
}
