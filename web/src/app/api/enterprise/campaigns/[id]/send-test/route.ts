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
import { CAMPAIGN_FEATURE_KEY, renderTemplate } from "@/lib/campaigns";
import { getConnectedSender, sendViaConnectedMailbox } from "@/lib/outreach/connected-send";

type Ctx = { params: Promise<{ id: string }> };
export const maxDuration = 30;

// POST /api/enterprise/campaigns/[id]/send-test { subject, body }
// Renders the step with sample values and emails it to the recruiter — preview
// the real thing before launch. Works on unsaved edits (content comes in the body).
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_send_emails");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { data: campaign } = await supabaseAdmin
    .from("enterprise_campaigns").select("id").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const { subject, body, to } = await req.json().catch(() => ({}));
  if (!subject?.trim() || !body?.trim()) return NextResponse.json({ error: "Subject and body are required." }, { status: 400 });

  const { data: orgData } = await supabaseAdmin
    .from("enterprise_orgs").select("name, white_label_email_from, slug, intake_email_handle, reply_to_email").eq("id", org.id).maybeSingle();
  const orgName = (orgData?.name as string) ?? org.name;
  const recruiter = await getRecruiterIdentity(userId);

  // Destination: an explicit address if given, else the recruiter's own email.
  const override = typeof to === "string" ? to.trim() : "";
  const dest = override || recruiter.email;
  if (!dest) return NextResponse.json({ error: "Enter an email to send the test to." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dest)) return NextResponse.json({ error: "That test email isn't valid." }, { status: 400 });

  const vars = {
    candidate_name: "Jordan Rivera",
    first_name: "Jordan",
    job_title: "Account Manager", // realistic sample so previews read naturally
    org_name: orgName,
    sender_name: recruiter.name,
  };
  const renderedSubject = `[TEST] ${renderTemplate(String(subject), vars)}`;
  const renderedBody = renderTemplate(String(body), vars);

  const fromName = emailFromName(orgName, (orgData?.white_label_email_from as string | null) ?? null);
  const intake = orgData?.slug ? intakeAddress({ slug: orgData.slug as string, intake_email_handle: (orgData.intake_email_handle as string | null) }) : null;
  const senderEmail = enterpriseSenderEmail(intake);
  const html = wrapEmail(renderOutreachBody(renderedBody, recruiter.name, orgName), false);

  // Send the test through the SAME sender the campaign uses, so it reflects real
  // deliverability (inbox vs spam) — a connected Gmail/Outlook if configured,
  // else the shared Resend address. Reply-to the org's shared inbox, as live sends do.
  const replyTo = intake || (orgData?.reply_to_email as string | null)?.trim() || null;
  const connected = await getConnectedSender(org.id);
  let sentFrom = senderEmail;
  if (connected) {
    const r = await sendViaConnectedMailbox(connected, { to: dest, subject: renderedSubject, html, fromName, replyTo });
    if (!r.ok) return NextResponse.json({ error: r.error ?? "Could not send the test from your connected mailbox." }, { status: 500 });
    sentFrom = connected.address;
  } else {
    const { error } = await resend.emails.send({
      from: `${fromName} <${senderEmail}>`,
      to: dest,
      subject: renderedSubject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { sent_to: dest, sent_from: sentFrom } });
}
