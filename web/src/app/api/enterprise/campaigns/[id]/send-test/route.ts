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

  const { subject, body } = await req.json().catch(() => ({}));
  if (!subject?.trim() || !body?.trim()) return NextResponse.json({ error: "Subject and body are required." }, { status: 400 });

  const { data: orgData } = await supabaseAdmin
    .from("enterprise_orgs").select("name, white_label_email_from, slug, intake_email_handle").eq("id", org.id).maybeSingle();
  const orgName = (orgData?.name as string) ?? org.name;
  const recruiter = await getRecruiterIdentity(userId);
  if (!recruiter.email) return NextResponse.json({ error: "Your account has no email to send the test to." }, { status: 400 });

  const vars = {
    candidate_name: "Jordan Rivera",
    first_name: "Jordan",
    job_title: "the role",
    org_name: orgName,
    sender_name: recruiter.name,
  };
  const renderedSubject = `[TEST] ${renderTemplate(String(subject), vars)}`;
  const renderedBody = renderTemplate(String(body), vars);

  const fromName = emailFromName(orgName, (orgData?.white_label_email_from as string | null) ?? null);
  const intake = orgData?.slug ? intakeAddress({ slug: orgData.slug as string, intake_email_handle: (orgData.intake_email_handle as string | null) }) : null;
  const senderEmail = enterpriseSenderEmail(intake);
  const html = wrapEmail(renderOutreachBody(renderedBody, recruiter.name, orgName), false);

  const { error } = await resend.emails.send({
    from: `${fromName} <${senderEmail}>`,
    to: recruiter.email,
    subject: renderedSubject,
    html,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: { sent_to: recruiter.email } });
}
