import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, enterpriseSenderEmail } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { resend } from "@/lib/resend";
import { wrapEmail, emailFromName } from "@/lib/email-utils";
import { renderOutreachBody, getRecruiterIdentity } from "@/lib/sourcing-email";
import { intakeAddress } from "@/lib/enterprise-intake-inbox";
import { logMessage, lastInboundRfcId } from "@/lib/enterprise-messages";
import { audit } from "@/lib/enterprise-audit";
import { executeSdrBooking } from "@/lib/outreach/ai-sdr";
import { getConnectedSender, sendViaConnectedMailbox, getLockedDomainSender } from "@/lib/outreach/connected-send";

export const maxDuration = 30;
type Ctx = { params: Promise<{ id: string }> };

async function authed() {
  const { userId } = await auth();
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const gate = await requireFeature(userId, "outreach_campaigns");
  if (gate) return { error: gate };
  const org = await getMyOrg(userId);
  if (!org) return { error: NextResponse.json({ error: "No organization." }, { status: 404 }) };
  return { userId, org };
}

// GET — the pending AI SDR draft awaiting review on this thread (if any).
export async function GET(_req: NextRequest, { params }: Ctx) {
  const a = await authed();
  if (a.error) return a.error;
  const { id } = await params;

  const { data } = await supabaseAdmin
    .from("ai_sdr_replies")
    .select("id, draft_subject, draft_body, model, created_at")
    .eq("org_id", a.org.id)
    .eq("thread_id", id)
    .eq("status", "needs_review")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ data: data ?? null });
}

// POST — act on a pending draft: { action: "send" | "dismiss", body?, subject? }
export async function POST(req: NextRequest, { params }: Ctx) {
  const a = await authed();
  if (a.error) return a.error;
  const { id } = await params;

  const { action, body: editedBody, subject: editedSubject } = await req.json().catch(() => ({}));
  const now = new Date().toISOString();

  const { data: draft } = await supabaseAdmin
    .from("ai_sdr_replies")
    .select("id, draft_subject, draft_body, book_slot, campaign_id, enrollment_id, candidate_email")
    .eq("org_id", a.org.id).eq("thread_id", id).eq("status", "needs_review")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const d = draft as { id: string; draft_subject: string | null; draft_body: string; book_slot: string | null; campaign_id: string | null; enrollment_id: string | null; candidate_email: string } | null;
  if (!d) return NextResponse.json({ error: "No draft to act on." }, { status: 404 });

  if (action === "dismiss") {
    await supabaseAdmin.from("ai_sdr_replies")
      .update({ status: "rejected", reviewed_by: a.userId, updated_at: now })
      .eq("id", d.id).eq("org_id", a.org.id);
    audit({ org_id: a.org.id, user_id: a.userId, action: "ai_sdr.reply_dismissed", resource_type: "ai_sdr_reply", resource_id: d.id, metadata: { thread_id: id } });
    return NextResponse.json({ data: { dismissed: true } });
  }

  if (action !== "send") return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const denied = await requirePermission(a.userId, "can_send_emails");
  if (denied) return denied;

  const { data: thread } = await supabaseAdmin
    .from("inbox_threads")
    .select("candidate_email, application_id, intent")
    .eq("id", id).eq("org_id", a.org.id).maybeSingle();
  const t = thread as { candidate_email: string; application_id: string | null; intent: string | null } | null;
  if (!t) return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  if (t.intent === "unsubscribe") return NextResponse.json({ error: "This contact unsubscribed." }, { status: 403 });

  let bodyText = (typeof editedBody === "string" && editedBody.trim()) ? editedBody.trim() : d.draft_body;

  // Conversational booking: the draft carries an agreed slot — book it before
  // sending the confirmation. If it was taken meanwhile, tell the reviewer.
  if (d.book_slot) {
    const booking = await executeSdrBooking({
      org_id: a.org.id, campaign_id: d.campaign_id, enrollment_id: d.enrollment_id,
      candidate_email: d.candidate_email || t.candidate_email, book_slot: d.book_slot,
    });
    if (!booking.ok) {
      return NextResponse.json({ error: `Couldn't book the agreed time (${booking.error ?? "it was just taken"}) — edit the reply to offer different times.` }, { status: 409 });
    }
    if (booking.meetLink) bodyText += `\n\nGoogle Meet: ${booking.meetLink}`;
  }

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("name, white_label_email_from, slug, intake_email_handle")
    .eq("id", a.org.id).maybeSingle();
  const orgName = (org?.name as string) ?? a.org.name;
  const fromName = emailFromName(orgName, (org?.white_label_email_from as string | null) ?? null);
  const recruiter = await getRecruiterIdentity(a.userId);
  const intake = org?.slug ? intakeAddress({ slug: org.slug as string, intake_email_handle: (org.intake_email_handle as string | null) }) : null;
  const replyTo = intake ? `${orgName} <${intake}>` : (recruiter.email ?? undefined);
  const senderEmail = enterpriseSenderEmail(intake);

  // Subject: ALWAYS continue the conversation's subject when one exists (same
  // rule as the auto-send cron) — a model-invented subject lands as a brand-new
  // Gmail conversation. A reviewer-edited subject wins; draft_subject is only
  // used when there is no prior thread subject at all.
  const { data: last } = await supabaseAdmin
    .from("enterprise_messages").select("subject")
    .eq("org_id", a.org.id)
    .or(`from_email.ilike.${t.candidate_email},to_email.ilike.${t.candidate_email}`)
    .not("subject", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const prev = (last?.subject as string | null) ?? null;
  const subjectLine =
    (typeof editedSubject === "string" && editedSubject.trim()) ||
    (prev ? (/^re:/i.test(prev) ? prev : `Re: ${prev}`) : (d.draft_subject?.trim() || `Message from ${orgName}`));

  const html = wrapEmail(renderOutreachBody(bodyText, recruiter.name, orgName), false);
  // Same sender identity as the campaign (connected mailbox when available) so
  // the candidate sees one continuous conversation; Reply-To stays the intake.
  // Prefer the CAMPAIGN CREATOR's mailbox (the identity the campaign sent
  // from), falling back to the approving user's own.
  let senderPrefer: string | null = a.userId;
  if (d.campaign_id) {
    const { data: camp } = await supabaseAdmin
      .from("enterprise_campaigns").select("created_by")
      .eq("id", d.campaign_id).eq("org_id", a.org.id).maybeSingle();
    senderPrefer = (camp as { created_by?: string | null } | null)?.created_by ?? a.userId;
  }
  // Domain-locked conversations stay on-domain (no Reply-To — the domain
  // receives); else the campaign creator's connected mailbox; else Resend.
  const domainSender = await getLockedDomainSender(a.org.id, t.candidate_email);
  const connected = domainSender ? null : await getConnectedSender(a.org.id, senderPrefer);
  const inReplyTo = await lastInboundRfcId(a.org.id, t.candidate_email);
  if (domainSender) {
    const { error } = await resend.emails.send({
      from: `${fromName} <${domainSender.address}>`,
      to: t.candidate_email, subject: subjectLine, html,
      ...(inReplyTo ? { headers: { "In-Reply-To": inReplyTo, References: inReplyTo } } : {}),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (connected) {
    const res = await sendViaConnectedMailbox(connected, {
      to: t.candidate_email, subject: subjectLine, html, fromName,
      replyTo: intake ?? recruiter.email ?? null,
      inReplyTo,
    });
    if (!res.ok) return NextResponse.json({ error: res.error ?? "Could not send from the connected mailbox." }, { status: 500 });
  } else {
    const { error } = await resend.emails.send({
      from: `${fromName} <${senderEmail}>`,
      to: t.candidate_email, subject: subjectLine, html,
      ...(replyTo ? { replyTo } : {}),
      ...(inReplyTo ? { headers: { "In-Reply-To": inReplyTo, References: inReplyTo } } : {}),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const edited = bodyText !== d.draft_body;
  await logMessage({
    orgId: a.org.id, applicationId: t.application_id, direction: "outbound",
    fromEmail: domainSender?.address ?? connected?.address ?? senderEmail,
    toEmail: t.candidate_email, subject: subjectLine, body: bodyText,
    sentVia: "ai_sdr",
  });
  await Promise.all([
    supabaseAdmin.from("ai_sdr_replies")
      .update({ status: "sent", sent_at: now, reviewed_by: a.userId, draft_body: bodyText, updated_at: now })
      .eq("id", d.id).eq("org_id", a.org.id),
    supabaseAdmin.from("inbox_threads")
      .update({
        last_outbound_at: now, unread: false, updated_at: now,
        ...(d.book_slot ? { outcome: "meeting_booked" } : {}),
      })
      .eq("id", id).eq("org_id", a.org.id),
  ]);
  audit({ org_id: a.org.id, user_id: a.userId, action: "ai_sdr.reply_sent", resource_type: "ai_sdr_reply", resource_id: d.id, metadata: { thread_id: id, mode: "reviewed", edited } });

  return NextResponse.json({ data: { sent: true } });
}
