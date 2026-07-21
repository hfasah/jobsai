import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminPerm } from "@/lib/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/health — latest health report per platform + recent history.
export async function GET() {
  const ctx = await requireAdminPerm("analytics");
  if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: reports, error } = await supabaseAdmin
    .from("platform_health_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(16);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const latestByPlatform: Record<string, string> = {};
  for (const r of reports ?? []) {
    if (!latestByPlatform[r.platform]) latestByPlatform[r.platform] = r.id;
  }
  const latestIds = Object.values(latestByPlatform);

  const { data: findings, error: fErr } = latestIds.length
    ? await supabaseAdmin
        .from("platform_health_findings")
        .select("*")
        .in("report_id", latestIds)
        .order("created_at", { ascending: true })
    : { data: [], error: null };
  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 });

  return NextResponse.json({ reports: reports ?? [], latest_ids: latestByPlatform, findings: findings ?? [] });
}
