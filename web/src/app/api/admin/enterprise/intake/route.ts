import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// GET — list intake/lead submissions (newest first), optionally by status.
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const status = new URL(req.url).searchParams.get("status") ?? "all";
  const query = supabaseAdmin
    .from("enterprise_intake")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (status !== "all") query.eq("status", status);

  const { data } = await query;
  return NextResponse.json({ data: data ?? [] });
}
