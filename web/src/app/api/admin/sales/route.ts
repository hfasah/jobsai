import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminPerm } from "@/lib/admin";
import { STAGE_BY_KEY } from "@/lib/sales-pipeline";

export const dynamic = "force-dynamic";

// GET — all deals (newest first).
export async function GET() {
  const admin = await requireAdminPerm("sales");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data } = await supabaseAdmin.from("sales_deals").select("*").order("updated_at", { ascending: false }).limit(1000);
  return NextResponse.json({ data: data ?? [] });
}

// POST — create a deal.
export async function POST(req: NextRequest) {
  const admin = await requireAdminPerm("sales");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const title = (b.title as string | undefined)?.trim();
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const stage = STAGE_BY_KEY[b.stage as string] ? (b.stage as string) : "new";
  const row = {
    title,
    company: (b.company as string | undefined)?.trim() || null,
    contact_name: (b.contact_name as string | undefined)?.trim() || null,
    contact_email: (b.contact_email as string | undefined)?.trim()?.toLowerCase() || null,
    owner: (b.owner as string | undefined)?.trim() || null,
    stage,
    value_cents: Math.max(0, Math.round(Number(b.value_cents) || 0)),
    probability: b.probability != null && b.probability !== "" ? Math.min(100, Math.max(0, Math.round(Number(b.probability)))) : null,
    expected_close_date: (b.expected_close_date as string | undefined) || null,
    lead_id: (b.lead_id as string | undefined) || null,
    notes: (b.notes as string | undefined)?.trim() || null,
    created_by: admin.userId,
  };

  const { data, error } = await supabaseAdmin.from("sales_deals").insert(row).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deal: data });
}
