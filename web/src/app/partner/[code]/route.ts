import { NextRequest, NextResponse } from "next/server";
import { PARTNER_REF_COOKIE, PARTNER_REF_MAX_AGE, REFERRAL_CODE_RE } from "@/lib/partner-program";

// Pretty referral link: /partner/ABC123 → drops a 90-day attribution cookie and
// sends the visitor to the enterprise landing page. Pairs with the ?r=CODE form
// handled in middleware.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const res = NextResponse.redirect(new URL("/enterprise/home", req.url));
  if (REFERRAL_CODE_RE.test(code)) {
    res.cookies.set(PARTNER_REF_COOKIE, code, {
      maxAge: PARTNER_REF_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
  }
  return res;
}
