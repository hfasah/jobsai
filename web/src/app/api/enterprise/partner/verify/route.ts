import { NextRequest, NextResponse } from "next/server";
import { verifyPartnerApplication } from "@/lib/partner-program";

// Confirm the emailed code → activate the partner and return their referral link.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim();
  const code = String(b.code ?? "").trim();
  if (!email || !code) return NextResponse.json({ error: "Email and code are required." }, { status: 400 });

  const result = await verifyPartnerApplication(email, code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const link = `${req.nextUrl.origin}/partner/${result.partner.referral_code}`;
  return NextResponse.json({
    data: {
      referral_code: result.partner.referral_code,
      link,
      commission_rate: result.partner.commission_rate,
      is_founding: result.partner.is_founding,
    },
  });
}
