import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";

type Ctx = { params: Promise<{ id: string }> };

// PATCH — update an intake's status (reviewed / archived / converted). When
// converting, the admin UI also passes the created org_id.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;

  const { status, org_id } = (await req.json().catch(() => ({}))) as { status?: string; org_id?: string };
  if (status && !["new", "reviewed", "converted", "archived"].includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (status) update.status = status;
  if (org_id) update.org_id = org_id;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { error } = await supabaseAdmin.from("enterprise_intake").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
