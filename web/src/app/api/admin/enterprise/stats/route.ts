import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// GET — aggregate plan + billing tallies for the enterprise accounts. Counts
// only, no names or PII. Auth: a logged-in admin (UI), OR an x-admin-stats-token
// header matching ADMIN_STATS_TOKEN (for programmatic/health checks).
export async function GET(req: NextRequest) {
  const token = process.env.ADMIN_STATS_TOKEN;
  const provided = req.headers.get("x-admin-stats-token");
  const tokenOk = !!token && provided === token;
  if (!tokenOk) {
    const admin = await requireAdmin();
    if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [{ data: orgs }, { data: plans }] = await Promise.all([
    supabaseAdmin.from("enterprise_orgs").select("plan_id, access_status, stripe_subscription_id, status"),
    supabaseAdmin.from("plans").select("id, slug"),
  ]);
  const slugById = new Map((plans ?? []).map((p) => [p.id as string, p.slug as string]));

  const byPlan: Record<string, number> = {};
  const byBilling: Record<string, number> = {};
  let suspended = 0;

  for (const o of orgs ?? []) {
    const planSlug = o.plan_id ? (slugById.get(o.plan_id) ?? "unknown") : "unassigned";
    byPlan[planSlug] = (byPlan[planSlug] ?? 0) + 1;

    let billing: string;
    if (o.access_status === "active") billing = o.stripe_subscription_id ? "paid" : "active";
    else if (o.access_status === "trialing") billing = "trial";
    else billing = o.access_status ?? "pending";
    byBilling[billing] = (byBilling[billing] ?? 0) + 1;

    if (o.status === "suspended") suspended++;
  }

  return NextResponse.json({
    data: { total: (orgs ?? []).length, suspended, byPlan, byBilling, generated_at: new Date().toISOString() },
  });
}
