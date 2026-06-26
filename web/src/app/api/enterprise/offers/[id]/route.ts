import { auth } from "@clerk/nextjs/server";
import { requirePermission } from "@/lib/enterprise-permissions";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { resend } from "@/lib/resend";
import { sendFromRecruiterGmail } from "@/lib/recruiter-gmail";
import { poweredByFooter, emailFromName } from "@/lib/email-utils";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("enterprise_offer_letters")
    .select("*")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Offer not found." }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(userId, "can_send_offers");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const { data: offer } = await supabaseAdmin
    .from("enterprise_offer_letters")
    .select("*")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!offer) return NextResponse.json({ error: "Offer not found." }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.content !== undefined) update.content = body.content;
  if (body.salary !== undefined) update.salary = body.salary;
  if (body.start_date !== undefined) update.start_date = body.start_date;
  if (body.notes !== undefined) update.notes = body.notes;

  // Send offer to candidate
  if (body.action === "send") {
    if (offer.status !== "draft") {
      return NextResponse.json({ error: "Only draft offers can be sent." }, { status: 400 });
    }
    update.status = "sent";
    const orgData = org as unknown as Record<string, unknown>;
    const showPoweredBy = (orgData.show_powered_by as boolean) ?? true;
    const fromName = emailFromName(org.name, orgData.white_label_email_from as string | null);
    const replyTo = ((orgData.reply_to_email as string) || (orgData.contact_email as string) || "").trim() || undefined;
    const signingUrl = `${APP_URL}/enterprise/offer/${offer.sign_token}`;
    const html = `<div style="font-family:sans-serif;max-width:580px;margin:0 auto;color:#0f172a">
      <h2 style="color:#2563eb">You have received an offer from ${org.name}</h2>
      <p>Hi ${offer.candidate_name},</p>
      <p>Please review your offer letter for <strong>${offer.job_title}</strong> at <strong>${org.name}</strong> by clicking the link below.</p>
      <p style="margin:24px 0">
        <a href="${signingUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
          Review &amp; Sign Offer →
        </a>
      </p>
      <p style="color:#64748b;font-size:13px">Or copy this link: ${signingUrl}</p>
      ${poweredByFooter(showPoweredBy)}
    </div>`;

    const subject = `Your offer letter — ${offer.job_title} at ${org.name}`;
    const gmailResult = await sendFromRecruiterGmail(userId, {
      to: offer.candidate_email as string,
      subject,
      html,
    }).catch(() => ({ ok: false }));
    if (!gmailResult.ok) {
      await resend.emails.send({
        from: `${fromName} <support@jobsai.work>`,
        replyTo,
        to: offer.candidate_email as string,
        subject,
        html,
      }).catch(console.error);
    }
  }

  // Withdraw
  if (body.action === "withdraw") {
    update.status = "withdrawn";
  }

  const { data, error } = await supabaseAdmin
    .from("enterprise_offer_letters")
    .update(update)
    .eq("id", id)
    .eq("org_id", org.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(userId, "can_send_offers");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  await supabaseAdmin.from("enterprise_offer_letters").delete().eq("id", id).eq("org_id", org.id);
  return NextResponse.json({ ok: true });
}
