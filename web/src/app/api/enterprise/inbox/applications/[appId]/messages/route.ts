import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, enterpriseSenderEmail } from "@/lib/enterprise";
import { resend } from "@/lib/resend";
import { wrapEmail, emailFromName } from "@/lib/email-utils";
import { renderOutreachBody, getRecruiterIdentity } from "@/lib/sourcing-email";
import { intakeAddress } from "@/lib/enterprise-intake-inbox";
import { logMessage } from "@/lib/enterprise-messages";

export const maxDuration = 30;
type Ctx = { params: Promise<{ appId: string }> };

// GET — the candidate's email conversation thread (outbound sends + inbound replies).
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { appId } = await params;

  const { data: app } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id, candidate_name, candidate_email")
    .eq("id", appId).eq("org_id", org.id).maybeSingle();
  if (!app) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: messages } = await supabaseAdmin
    .from("enterprise_messages")
    .select("id, direction, from_email, to_email, subject, body, created_at")
    .eq("org_id", org.id).eq("application_id", appId)
    .order("created_at", { ascending: true }).limit(200);

  return NextResponse.json({ data: { candidate: app, messages: messages ?? [] } });
}

// POST { body, subject? } — reply to the candidate from inside JobsAI. Sends
// white-label with Reply-To = the org intake address so the loop stays in-system.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { appId } = await params;

  const { body, subject } = await req.json().catch(() => ({}));
  if (!body || !String(body).trim()) return NextResponse.json({ error: "Message body required." }, { status: 400 });

  const { data: app } = await supabaseAdmin
    .from("enterprise_applications")
    .select("candidate_email, candidate_name")
    .eq("id", appId).eq("org_id", org.id).maybeSingle();
  if (!app?.candidate_email) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });

  const { data: orgData } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("name, white_label_email_from, slug, intake_email_handle")
    .eq("id", org.id).maybeSingle();
  const orgName = orgData?.name ?? org.name;
  const fromName = emailFromName(orgName, orgData?.white_label_email_from ?? null);
  const { name: recruiterName, email: recruiterEmail } = await getRecruiterIdentity(userId);
  const intake = orgData?.slug ? intakeAddress({ slug: orgData.slug, intake_email_handle: orgData.intake_email_handle }) : null;
  const replyTo = intake ? `${orgName} <${intake}>` : (recruiterEmail ?? undefined);
  const senderEmail = enterpriseSenderEmail(intake);

  // Keep the same subject thread when possible.
  const { data: last } = await supabaseAdmin
    .from("enterprise_messages")
    .select("subject").eq("application_id", appId).not("subject", "is", null)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const prev = (last?.subject as string | null) ?? null;
  const subjectLine = (typeof subject === "string" && subject.trim())
    || (prev ? (/^re:/i.test(prev) ? prev : `Re: ${prev}`) : `Message from ${orgName}`);

  const html = wrapEmail(renderOutreachBody(String(body), recruiterName, orgName), false);
  const { error } = await resend.emails.send({
    from: `${fromName} <${senderEmail}>`,
    to: app.candidate_email as string,
    subject: subjectLine,
    html,
    ...(replyTo ? { replyTo } : {}),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logMessage({
    orgId: org.id, applicationId: appId, direction: "outbound",
    fromEmail: senderEmail, toEmail: app.candidate_email as string,
    subject: subjectLine, body: String(body),
  });

  return NextResponse.json({ ok: true });
}
