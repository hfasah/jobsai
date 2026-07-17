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
import { getConnectedSender, sendViaConnectedMailbox } from "@/lib/outreach/connected-send";

export const maxDuration = 30;

// POST /api/enterprise/outreach/inbox/[id]/reply { body, subject? }
// White-label reply to a thread's candidate. Mirrors the application-thread
// reply, but keyed off the inbox_threads row (works even when the thread has
// no application_id). Replies to jobsai.work identity by design — the
// recruiter is answering a warm reply, not cold-sending, so shared-domain
// reputation isn't a concern here.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "outreach_campaigns");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_send_emails");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await ctx.params;
  // `to` turns the send into a FORWARD (e.g. to a hiring manager): different
  // recipient, "Fwd:" subject, no candidate-thread headers.
  const { body, subject, to } = await req.json().catch(() => ({}));
  if (!body || !String(body).trim()) return NextResponse.json({ error: "Message body required." }, { status: 400 });
  const forwardTo = typeof to === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim()) ? to.trim().toLowerCase() : null;
  if (to && !forwardTo) return NextResponse.json({ error: "Enter a valid email address to forward to." }, { status: 400 });

  const { data: thread } = await supabaseAdmin
    .from("inbox_threads")
    .select("id, candidate_email, candidate_name, application_id, intent")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  const t = thread as { id: string; candidate_email: string; candidate_name: string | null; application_id: string | null; intent: string | null } | null;
  if (!t) return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  if (!forwardTo && t.intent === "unsubscribe") {
    return NextResponse.json({ error: "This contact unsubscribed — you can't email them." }, { status: 403 });
  }

  const { data: orgData } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("name, white_label_email_from, slug, intake_email_handle")
    .eq("id", org.id)
    .maybeSingle();
  const orgName = (orgData?.name as string) ?? org.name;
  const fromName = emailFromName(orgName, (orgData?.white_label_email_from as string | null) ?? null);
  const { name: recruiterName, email: recruiterEmail } = await getRecruiterIdentity(userId);
  const intake = orgData?.slug ? intakeAddress({ slug: orgData.slug as string, intake_email_handle: (orgData.intake_email_handle as string | null) }) : null;
  const replyTo = intake ? `${orgName} <${intake}>` : (recruiterEmail ?? undefined);
  const senderEmail = enterpriseSenderEmail(intake);

  // Keep the subject thread — look up the latest prior subject by application
  // OR by the candidate's email (email-matched threads used to fall through to
  // a generic subject and start a new Gmail conversation).
  const { data: last } = await supabaseAdmin
    .from("enterprise_messages")
    .select("subject")
    .eq("org_id", org.id)
    .or(`from_email.ilike.${t.candidate_email},to_email.ilike.${t.candidate_email}`)
    .not("subject", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prev = (last?.subject as string | null) ?? null;
  const baseSubject = prev ? prev.replace(/^(re|fwd?):\s*/i, "") : null;
  const subjectLine =
    (typeof subject === "string" && subject.trim()) ||
    (forwardTo
      ? (baseSubject ? `Fwd: ${baseSubject}` : `Fwd: Conversation with ${t.candidate_name || t.candidate_email}`)
      : (prev ? (/^re:/i.test(prev) ? prev : `Re: ${prev}`) : `Message from ${orgName}`));

  const recipient = forwardTo ?? t.candidate_email;
  const html = wrapEmail(renderOutreachBody(String(body), recruiterName, orgName), false);
  // Send from the REPLYING recruiter's own connected mailbox when they have
  // one (else any org mailbox, else white-label Resend) — same identity rules
  // as the SDR paths, so the conversation never switches From address.
  const connected = await getConnectedSender(org.id, userId);
  // Thread into the candidate's conversation only when actually replying to
  // them; a forward is a fresh conversation for the teammate.
  const inReplyTo = forwardTo ? null : await lastInboundRfcId(org.id, t.candidate_email);
  let sendError: string | null = null;
  let sentFrom = senderEmail;
  if (connected) {
    const res = await sendViaConnectedMailbox(connected, {
      to: recipient, subject: subjectLine, html, fromName,
      replyTo: intake ?? recruiterEmail ?? null,
      inReplyTo,
    });
    if (!res.ok) sendError = res.error ?? "Could not send from the connected mailbox.";
    else sentFrom = connected.address;
  } else {
    const { error } = await resend.emails.send({
      from: `${fromName} <${senderEmail}>`,
      to: recipient,
      subject: subjectLine,
      html,
      ...(replyTo ? { replyTo } : {}),
      ...(inReplyTo ? { headers: { "In-Reply-To": inReplyTo, References: inReplyTo } } : {}),
    });
    if (error) sendError = error.message;
  }
  if (sendError) return NextResponse.json({ error: sendError }, { status: 500 });

  await logMessage({
    orgId: org.id,
    applicationId: t.application_id,
    direction: "outbound",
    fromEmail: sentFrom,
    toEmail: recipient,
    subject: subjectLine,
    body: String(body),
  });

  // Replying implicitly handles the thread: mark read, record the send.
  // (Forwards don't touch the candidate conversation state.)
  if (!forwardTo) {
    await supabaseAdmin
      .from("inbox_threads")
      .update({ last_outbound_at: new Date().toISOString(), unread: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", org.id);
    // A human took the conversation → "Manual Reply" chip, unless a meeting is
    // already booked (that outcome is stickier).
    await supabaseAdmin
      .from("inbox_threads")
      .update({ outcome: "manual_reply" })
      .eq("id", id).eq("org_id", org.id)
      .is("outcome", null);
  }

  return NextResponse.json({ data: { sent: true, forwarded: !!forwardTo } });
}
