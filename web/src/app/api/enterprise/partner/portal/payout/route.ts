import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getPartnerByPortalToken } from "@/lib/partner-program";

const METHODS = ["paypal", "wise", "bank", "manual"];

// Update payout details from the magic-link portal (token is the credential).
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const token = String(b.token ?? "");
  const partner = await getPartnerByPortalToken(token);
  if (!partner) return NextResponse.json({ error: "Invalid or expired link." }, { status: 403 });

  const method = String(b.payout_method ?? "").trim().toLowerCase();
  const update: Record<string, unknown> = {
    payout_email: String(b.payout_email ?? "").trim() || null,
    payout_details: String(b.payout_details ?? "").trim() || null,
  };
  if (METHODS.includes(method)) update.payout_method = method;

  const { error } = await supabaseAdmin.from("partner_accounts").update(update).eq("id", partner.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
