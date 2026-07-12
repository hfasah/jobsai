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
import { audit } from "@/lib/enterprise-audit";

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
    .select("id, draft_subject, draft_body")
    .eq("org_id", a.org.id).eq("thread_id", id).eq("status", "needs_review")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const d = draft as { id: string; draft_subject: string | null; draft_body: string } | null;
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

  const bodyText = (typeof editedBody === "string" && editedBody.trim()) ? editedBody.trim() : d.draft_body;

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

  let subjectLine = (typeof editedSubject === "string" && editedSubject.trim()) || d.draft_subject?.trim() || "";
  if (!subjectLine) {
    const { data: last } = await supabaseAdmin
      .from("enterprise_messages").select("subject")
      .eq("org_id", a.org.id)
      .or(`from_email.ilike.${t.candidate_email},to_email.ilike.${t.candidate_email}`)
      .not("subject", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    const prev = (last?.subject as string | null) ?? null;
    subjectLine = prev ? (/^re:/i.test(prev) ? prev : `Re: ${prev}`) : `Message from ${orgName}`;
  }

  const html = wrapEmail(renderOutreachBody(bodyText, recruiter.name, orgName), false);
  const { error } = await resend.emails.send({
    from: `${fromName} <${senderEmail}>`,
    to: t.candidate_email, subject: subjectLine, html,
    ...(replyTo ? { replyTo } : {}),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const edited = bodyText !== d.draft_body;
  await logMessage({
    orgId: a.org.id, applicationId: t.application_id, direction: "outbound",
    fromEmail: senderEmail, toEmail: t.candidate_email, subject: subjectLine, body: bodyText,
    sentVia: "ai_sdr",
  });
  await Promise.all([
    supabaseAdmin.from("ai_sdr_replies")
      .update({ status: "sent", sent_at: now, reviewed_by: a.userId, draft_body: bodyText, updated_at: now })
      .eq("id", d.id).eq("org_id", a.org.id),
    supabaseAdmin.from("inbox_threads")
      .update({ last_outbound_at: now, unread: false, updated_at: now })
      .eq("id", id).eq("org_id", a.org.id),
  ]);
  audit({ org_id: a.org.id, user_id: a.userId, action: "ai_sdr.reply_sent", resource_type: "ai_sdr_reply", resource_id: d.id, metadata: { thread_id: id, mode: "reviewed", edited } });

  return NextResponse.json({ data: { sent: true } });
}
