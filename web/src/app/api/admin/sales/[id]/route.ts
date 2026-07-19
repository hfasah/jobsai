import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminPerm } from "@/lib/admin";
import { STAGE_BY_KEY } from "@/lib/sales-pipeline";

export const dynamic = "force-dynamic";

// PATCH — update a deal (fields and/or stage). Used by the board's drag-to-move
// and the edit modal.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPerm("sales");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.title === "string") patch.title = b.title.trim();
  if ("company" in b) patch.company = (b.company as string | null)?.toString().trim() || null;
  if ("contact_name" in b) patch.contact_name = (b.contact_name as string | null)?.toString().trim() || null;
  if ("contact_email" in b) patch.contact_email = (b.contact_email as string | null)?.toString().trim().toLowerCase() || null;
  if ("owner" in b) patch.owner = (b.owner as string | null)?.toString().trim() || null;
  if (typeof b.stage === "string" && STAGE_BY_KEY[b.stage]) patch.stage = b.stage;
  if ("value_cents" in b) patch.value_cents = Math.max(0, Math.round(Number(b.value_cents) || 0));
  if ("probability" in b) patch.probability = b.probability != null && b.probability !== "" ? Math.min(100, Math.max(0, Math.round(Number(b.probability)))) : null;
  if ("expected_close_date" in b) patch.expected_close_date = (b.expected_close_date as string | null) || null;
  if ("notes" in b) patch.notes = (b.notes as string | null)?.toString().trim() || null;

  const { data, error } = await supabaseAdmin.from("sales_deals").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deal: data });
}

// DELETE — remove a deal.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPerm("sales");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const { error } = await supabaseAdmin.from("sales_deals").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
