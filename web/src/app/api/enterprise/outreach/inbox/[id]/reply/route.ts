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
import { logMessage } from "@/lib/enterprise-messages";

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
  const { body, subject } = await req.json().catch(() => ({}));
  if (!body || !String(body).trim()) return NextResponse.json({ error: "Message body required." }, { status: 400 });

  const { data: thread } = await supabaseAdmin
    .from("inbox_threads")
    .select("id, candidate_email, candidate_name, application_id, intent")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  const t = thread as { id: string; candidate_email: string; candidate_name: string | null; application_id: string | null; intent: string | null } | null;
  if (!t) return NextResponse.json({ error: "Thread not found." }, { status: 404 });
  if (t.intent === "unsubscribe") {
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

  // Keep the subject thread when we can find a prior subject.
  let prev: string | null = null;
  if (t.application_id) {
    const { data: last } = await supabaseAdmin
      .from("enterprise_messages")
      .select("subject")
      .eq("org_id", org.id)
      .eq("application_id", t.application_id)
      .not("subject", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    prev = (last?.subject as string | null) ?? null;
  }
  const subjectLine =
    (typeof subject === "string" && subject.trim()) ||
    (prev ? (/^re:/i.test(prev) ? prev : `Re: ${prev}`) : `Message from ${orgName}`);

  const html = wrapEmail(renderOutreachBody(String(body), recruiterName, orgName), false);
  const { error } = await resend.emails.send({
    from: `${fromName} <${senderEmail}>`,
    to: t.candidate_email,
    subject: subjectLine,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logMessage({
    orgId: org.id,
    applicationId: t.application_id,
    direction: "outbound",
    fromEmail: senderEmail,
    toEmail: t.candidate_email,
    subject: subjectLine,
    body: String(body),
  });

  // Replying implicitly handles the thread: mark read, record the send.
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

  return NextResponse.json({ data: { sent: true } });
}
