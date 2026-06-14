import { NextRequest, NextResponse } from "next/server";
import { getPartnerByPortalToken, rotatePortalToken } from "@/lib/partner-program";

// True sign-out: rotates the magic-link token so the current URL stops working
// (for shared computers). The partner requests a fresh link by email to return.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const token = String(b.token ?? "");
  const partner = await getPartnerByPortalToken(token);
  if (partner) await rotatePortalToken(partner.id);
  return NextResponse.json({ ok: true });
}
