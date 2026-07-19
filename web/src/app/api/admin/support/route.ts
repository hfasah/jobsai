import { NextRequest, NextResponse } from "next/server";
import { requireAdminPerm } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const ctx = await requireAdminPerm("support");
  return ctx ? ctx.userId : null;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "open";

  // Folders (unread/sent) are derived client-side from read_at/last_inbound_at/
  // replied_at, so return everything recent and let the UI group & filter.
  const query = supabaseAdmin
    .from("support_tickets")
    .select("*")
    .order("last_inbound_at", { ascending: false, nullsFirst: false })
    .limit(500);

  if (status !== "all" && status !== "unread" && status !== "sent") query.eq("status", status);

  const { data } = await query;
  return NextResponse.json({ tickets: data ?? [] });
}
