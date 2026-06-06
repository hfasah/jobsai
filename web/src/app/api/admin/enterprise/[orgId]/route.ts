import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";

type Ctx = { params: Promise<{ orgId: string }> };

// GET — org detail + members + LLM cost breakdown
export async function GET(_req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { orgId } = await params;

  const { data: org } = await supabaseAdmin.from("enterprise_orgs").select("*").eq("id", orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: "Org not found." }, { status: 404 });

  const [members, jobs, apps, usage] = await Promise.all([
    supabaseAdmin.from("enterprise_members").select("user_id, role, created_at").eq("org_id", orgId),
    supabaseAdmin.from("enterprise_jobs").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabaseAdmin.from("enterprise_applications").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabaseAdmin.from("llm_usage").select("feature, model, input_tokens, output_tokens, cost_usd, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(2000),
  ]);

  const rows = usage.data ?? [];
  const totalCost = rows.reduce((s, r) => s + Number(r.cost_usd), 0);
  const totalTokens = rows.reduce((s, r) => s + r.input_tokens + r.output_tokens, 0);

  // by feature
  const byFeature: Record<string, { calls: number; cost: number; tokens: number }> = {};
  for (const r of rows) {
    const f = (byFeature[r.feature] ??= { calls: 0, cost: 0, tokens: 0 });
    f.calls++; f.cost += Number(r.cost_usd); f.tokens += r.input_tokens + r.output_tokens;
  }

  // last 30 days daily
  const byDay: Record<string, number> = {};
  const cutoff = Date.now() - 30 * 86_400_000;
  for (const r of rows) {
    if (new Date(r.created_at).getTime() < cutoff) continue;
    const d = r.created_at.slice(0, 10);
    byDay[d] = (byDay[d] ?? 0) + Number(r.cost_usd);
  }

  return NextResponse.json({ data: {
    org,
    members: members.data ?? [],
    jobs: jobs.count ?? 0,
    applicants: apps.count ?? 0,
    llm: {
      total_cost: Math.round(totalCost * 1000) / 1000,
      total_calls: rows.length,
      total_tokens: totalTokens,
      by_feature: Object.entries(byFeature).map(([feature, v]) => ({ feature, calls: v.calls, cost: Math.round(v.cost * 1000) / 1000, tokens: v.tokens })).sort((a, b) => b.cost - a.cost),
      by_day: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).map(([date, cost]) => ({ date, cost: Math.round(cost * 1000) / 1000 })),
    },
  } });
}

// PUT — admin updates (notes, status, plan label, onboarding flag)
export async function PUT(req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { orgId } = await params;
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  for (const f of ["admin_notes", "status", "plan_label", "onboarding_done", "industry", "name"]) {
    if (body[f] !== undefined) update[f] = body[f];
  }

  const { data, error } = await supabaseAdmin.from("enterprise_orgs").update(update).eq("id", orgId).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
