import { NextResponse } from "next/server";
import { requireAdminPerm } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const ctx = await requireAdminPerm("analytics");
  return ctx ? ctx.userId : null;
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await supabaseAdmin
    .from("churn_feedback")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json({ rows: data ?? [] });
}
