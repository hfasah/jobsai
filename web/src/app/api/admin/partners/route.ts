import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { resend } from "@/lib/resend";
import { adminCreatePartner } from "@/lib/partner-program";
import { listPartnersForAdmin } from "@/lib/partner-payouts";
import { FROM_PARTNER_TEAM, partnerInviteEmailHtml } from "@/lib/partner-emails";

const validEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

// List all partners + stats for the admin portal.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const partners = await listPartnersForAdmin();
  return NextResponse.json({ data: partners });
}

// Create a partner directly (active + verified) and email them their links.
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim();
  const name = String(b.name ?? "").trim();
  if (!validEmail(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });

  let partner;
  try {
    partner = await adminCreatePartner({
      name: name || null,
      email,
      company_name: String(b.company_name ?? "").trim() || null,
      audience_type: String(b.audience_type ?? "").trim() || null,
      website: String(b.website ?? "").trim() || null,
      commission_rate: b.commission_rate != null && Number.isFinite(Number(b.commission_rate)) ? Number(b.commission_rate) : null,
      is_founding: b.is_founding === true ? true : undefined,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create partner." }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  // The invitation links to the partner's portal; while pending it shows the
  // "accept your invitation" screen, then becomes their dashboard.
  const acceptLink = partner.portal_token ? `${origin}/enterprise/partners/portal/${partner.portal_token}` : `${origin}/enterprise/partners/portal`;

  let emailed = false;
  try {
    await resend.emails.send({
      from: FROM_PARTNER_TEAM,
      to: email,
      subject: "🎉 You're invited: JobsAI Enterprise Partner Program",
      html: partnerInviteEmailHtml({ name, rate: partner.commission_rate, acceptUrl: acceptLink }),
    });
    emailed = true;
  } catch {
    // Link is returned below so the admin can share manually.
  }

  return NextResponse.json({ data: { partner, acceptLink, emailed } });
}

// Update a partner: approve / suspend / reactivate, or adjust commission rate.
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = body.id as string | undefined;
  if (!id) return NextResponse.json({ error: "Missing partner id" }, { status: 400 });

  const update: Record<string, unknown> = {};
  if (typeof body.status === "string" && ["pending", "active", "suspended"].includes(body.status)) {
    update.status = body.status;
    if (body.status === "active") update.approved_at = new Date().toISOString();
  }
  if (body.commission_rate != null) {
    const rate = Number(body.commission_rate);
    if (Number.isFinite(rate) && rate >= 0 && rate <= 100) update.commission_rate = rate;
  }
  if (typeof body.tier === "string" && ["recruiting", "growth", "strategic"].includes(body.tier)) {
    update.tier = body.tier;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("partner_accounts")
    .update(update)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
