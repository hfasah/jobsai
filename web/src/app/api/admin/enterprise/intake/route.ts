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

  const [{ data }, { data: statusRows }] = await Promise.all([
    query,
    supabaseAdmin.from("enterprise_intake").select("status"),
  ]);

  // Per-stage counts so the filter tabs can show numbers without a click.
  const counts: Record<string, number> = { all: 0, new: 0, reviewed: 0, converted: 0, archived: 0 };
  for (const r of (statusRows ?? []) as { status: string }[]) {
    counts.all++;
    counts[r.status] = (counts[r.status] ?? 0) + 1;
  }

  return NextResponse.json({ data: data ?? [], counts });
}
