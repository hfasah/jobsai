import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { enterpriseSenderEmail } from "@/lib/enterprise";
import { resend } from "@/lib/resend";
import { wrapEmail, emailFromName } from "@/lib/email-utils";
import { renderOutreachBody, getRecruiterIdentity } from "@/lib/sourcing-email";
import { intakeAddress } from "@/lib/enterprise-intake-inbox";
import { logMessage } from "@/lib/enterprise-messages";
import { audit } from "@/lib/enterprise-audit";
import { isWithinSendWindow, nextWindowOpen, type SendWindow } from "@/lib/outreach/send-window";
import { executeSdrBooking } from "@/lib/outreach/ai-sdr";
import { getConnectedSender, sendViaConnectedMailbox } from "@/lib/outreach/connected-send";
import { isEmailSuppressed } from "@/lib/outreach/suppression";

export const maxDuration = 60;

const BATCH = 40;

// Sends AI SDR auto-replies whose scheduled_at is due. Draft-mode replies never
// reach here (they sit as 'needs_review' for a human); only 'queued' rows do.
// Re-validates each row at send time — an unsubscribe, a disabled campaign, or a
// newer inbound reply supersedes a stale draft.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const { data: due } = await supabaseAdmin
    .from("ai_sdr_replies")
    .select("id, org_id, thread_id, campaign_id, enrollment_id, candidate_email, draft_subject, draft_body, book_slot, created_at")
    .eq("status", "queued")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(BATCH);

  const rows = (due ?? []) as {
    id: string; org_id: string; thread_id: string; campaign_id: string | null; enrollment_id: string | null;
    candidate_email: string; draft_subject: string | null; draft_body: string; book_slot: string | null; created_at: string;
  }[];

  const summary = { sent: 0, suppressed: 0, deferred: 0, failed: 0 };

  for (const r of rows) {
    try {
      const [{ data: thread }, { data: campaign }, { data: org }] = await Promise.all([
        supabaseAdmin.from("inbox_threads")
          .select("id, candidate_email, candidate_name, application_id, intent, last_inbound_at")
          .eq("id", r.thread_id).eq("org_id", r.org_id).maybeSingle(),
        r.campaign_id
          ? supabaseAdmin.from("enterprise_campaigns")
              .select("id, status, created_by, ai_sdr_enabled, send_window_start, send_window_end, send_timezone, business_days_only")
              .eq("id", r.campaign_id).eq("org_id", r.org_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabaseAdmin.from("enterprise_orgs")
          .select("name, white_label_email_from, slug, intake_email_handle, ai_sdr_paused")
          .eq("id", r.org_id).maybeSingle(),
      ]);

      const t = thread as { candidate_email: string; candidate_name: string | null; application_id: string | null; intent: string | null; last_inbound_at: string | null } | null;
      const c = campaign as { id: string; status: string; created_by: string; ai_sdr_enabled: boolean; send_window_start: number | null; send_window_end: number | null; send_timezone: string | null; business_days_only: boolean } | null;

      const suppress = async (reason: string) => {
        summary.suppressed++;
        await supabaseAdmin.from("ai_sdr_replies")
          .update({ status: "suppressed", suppressed_reason: reason, updated_at: new Date().toISOString() })
          .eq("id", r.id).eq("org_id", r.org_id);
      };

      if ((org as { ai_sdr_paused?: boolean } | null)?.ai_sdr_paused) { await suppress("Workspace AI SDR paused."); continue; }
      if (!t) { await suppress("Thread gone."); continue; }
      if (t.intent === "unsubscribe") { await suppress("Contact unsubscribed."); continue; }
      if (!c || !c.ai_sdr_enabled || c.status !== "active") { await suppress("Campaign disabled or inactive."); continue; }
      // A newer inbound arrived after this draft was made → a fresher draft
      // exists; this one is stale.
      if (t.last_inbound_at && new Date(t.last_inbound_at).getTime() > new Date(r.created_at).getTime()) {
        await suppress("Superseded by a newer reply."); continue;
      }

      // Respect the send window — defer rather than send off-hours.
      const window: SendWindow = {
        send_window_start: c.send_window_start, send_window_end: c.send_window_end,
        send_timezone: c.send_timezone, business_days_only: c.business_days_only,
      };
      if (!isWithinSendWindow(window)) {
        summary.deferred++;
        await supabaseAdmin.from("ai_sdr_replies")
          .update({ scheduled_at: nextWindowOpen(window).toISOString(), updated_at: new Date().toISOString() })
          .eq("id", r.id).eq("org_id", r.org_id);
        continue;
      }

      // White-label identity (jobsai.work sender + org intake reply-to), same as
      // the manual inbox reply — replying to a warm lead, not cold-blasting.
      const orgName = (org?.name as string) ?? "Recruiting";
      const fromName = emailFromName(orgName, (org?.white_label_email_from as string | null) ?? null);
      const recruiter = await getRecruiterIdentity(c.created_by);
      const intake = org?.slug ? intakeAddress({ slug: org.slug as string, intake_email_handle: (org.intake_email_handle as string | null) }) : null;
      const replyTo = intake ? `${orgName} <${intake}>` : (recruiter.email ?? undefined);
      const senderEmail = enterpriseSenderEmail(intake);

      // Subject: ALWAYS thread on the conversation's subject when one exists —
      // model-invented subjects broke Gmail threading (the reply landed as a
      // brand-new conversation the recruiter/candidate never saw).
      let subjectLine = "";
      {
        const { data: last } = await supabaseAdmin
          .from("enterprise_messages")
          .select("subject")
          .eq("org_id", r.org_id)
          .or(`from_email.ilike.${r.candidate_email},to_email.ilike.${r.candidate_email}`)
          .not("subject", "is", null)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        const prev = (last?.subject as string | null) ?? null;
        subjectLine = prev
          ? (/^re:/i.test(prev) ? prev : `Re: ${prev}`)
          : (r.draft_subject?.trim() || `Message from ${orgName}`);
      }

      // Compliance: a suppression may have landed after this draft was queued.
      if (await isEmailSuppressed(r.org_id, r.candidate_email)) {
        await supabaseAdmin.from("ai_sdr_replies")
          .update({ status: "suppressed", suppressed_reason: "Contact is on Do-Not-Contact.", updated_at: new Date().toISOString() })
          .eq("id", r.id).eq("org_id", r.org_id);
        continue;
      }

      // Conversational booking: the draft carries an agreed slot — book it NOW,
      // before the confirmation email goes out. If the slot got taken in the
      // meantime, hold the draft for human review instead of sending a false
      // confirmation.
      let bodyText = r.draft_body as string;
      if (r.book_slot) {
        const booking = await executeSdrBooking({
          org_id: r.org_id, campaign_id: r.campaign_id, enrollment_id: (r as { enrollment_id?: string | null }).enrollment_id ?? null,
          candidate_email: r.candidate_email, book_slot: r.book_slot as string,
        });
        if (!booking.ok) {
          await supabaseAdmin.from("ai_sdr_replies")
            .update({ status: "needs_review", suppressed_reason: `Couldn't book the agreed time (${booking.error ?? "taken"}) — review and re-offer times.`, updated_at: new Date().toISOString() })
            .eq("id", r.id).eq("org_id", r.org_id);
          continue;
        }
        if (booking.meetLink) bodyText += `\n\nGoogle Meet: ${booking.meetLink}`;
      }

      const html = wrapEmail(renderOutreachBody(bodyText, recruiter.name, orgName), false);
      // Send from the SAME identity the campaign used — the recruiter's
      // connected mailbox when the org has one — so the conversation stays in
      // one thread for the candidate. Reply-To stays the intake address so
      // their answers keep landing in the AI SDR Inbox.
      const connected = await getConnectedSender(r.org_id);
      let sendError: string | null = null;
      if (connected) {
        const res = await sendViaConnectedMailbox(connected, {
          to: t.candidate_email, subject: subjectLine, html, fromName,
          replyTo: intake ?? recruiter.email ?? null,
        });
        if (!res.ok) sendError = res.error ?? "connected send failed";
      } else {
        const { error } = await resend.emails.send({
          from: `${fromName} <${senderEmail}>`,
          to: t.candidate_email,
          subject: subjectLine,
          html,
          ...(replyTo ? { replyTo } : {}),
        });
        if (error) sendError = error.message;
      }
      if (sendError) {
        summary.failed++;
        await supabaseAdmin.from("ai_sdr_replies")
          .update({ status: "failed", suppressed_reason: sendError, updated_at: new Date().toISOString() })
          .eq("id", r.id).eq("org_id", r.org_id);
        continue;
      }

      await logMessage({
        orgId: r.org_id, applicationId: t.application_id, direction: "outbound",
        fromEmail: senderEmail, toEmail: t.candidate_email, subject: subjectLine, body: bodyText,
        sentVia: "ai_sdr",
      });
      await Promise.all([
        supabaseAdmin.from("ai_sdr_replies")
          .update({ status: "sent", sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", r.id).eq("org_id", r.org_id),
        supabaseAdmin.from("inbox_threads")
          .update({ last_outbound_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", r.thread_id).eq("org_id", r.org_id),
      ]);
      audit({
        org_id: r.org_id,
        action: "ai_sdr.reply_sent",
        resource_type: "ai_sdr_reply",
        resource_id: r.id,
        metadata: { thread_id: r.thread_id, campaign_id: r.campaign_id, mode: "auto" },
      });
      summary.sent++;
    } catch (e) {
      summary.failed++;
      console.error("[cron/ai-sdr] send failed", r.id, e);
    }
  }

  return NextResponse.json({ ok: true, processed: rows.length, ...summary });
}
