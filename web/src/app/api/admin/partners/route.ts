import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";
import { listPartnersForAdmin } from "@/lib/partner-payouts";

// List all partners + stats for the admin portal.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const partners = await listPartnersForAdmin();
  return NextResponse.json({ data: partners });
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
