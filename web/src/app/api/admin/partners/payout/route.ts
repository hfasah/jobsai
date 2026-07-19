import { NextRequest, NextResponse } from "next/server";
import { requireAdminPerm } from "@/lib/admin";
import { payOutPartner } from "@/lib/partner-payouts";

// Mark a partner's cleared commissions as paid (manual Phase-1 payout). Records
// an auditable payout batch with the method + external reference.
export async function POST(req: NextRequest) {
  const admin = await requireAdminPerm("partners.payout");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const partnerId = body.partner_id as string | undefined;
  if (!partnerId) return NextResponse.json({ error: "Missing partner_id" }, { status: 400 });

  const result = await payOutPartner(partnerId, {
    method: (body.method as string | undefined) ?? null,
    reference: (body.reference as string | undefined) ?? null,
    adminUserId: admin.userId,
  });

  if (result.amountCents === 0) {
    return NextResponse.json({ error: "No cleared commissions to pay out." }, { status: 400 });
  }
  return NextResponse.json({ data: result });
}
