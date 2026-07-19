import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminPerm } from "@/lib/admin";

type Ctx = { params: Promise<{ orgId: string }> };

// GET — org detail + members + LLM cost breakdown
export async function GET(_req: NextRequest, { params }: Ctx) {
  const admin = await requireAdminPerm("enterprise.manage");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { orgId } = await params;

  const { data: org } = await supabaseAdmin.from("enterprise_orgs").select("*").eq("id", orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: "Org not found." }, { status: 404 });

  const [members, jobs, apps, usage] = await Promise.all([
    supabaseAdmin.from("enterprise_members").select("user_id, role, created_at").eq("org_id", orgId),
    supabaseAdmin.from("enterprise_jobs").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabaseAdmin.from("enterprise_applications").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    supabaseAdmin.from("llm_usage").select("feature, model, input_tokens, output_tokens, cost_usd, created_at").eq("org_id", orgId).order("created_at", { ascending: false }).limit(2000),
  ]);

  // Enrich members with their real name/email (the actual people in the account)
  const client = await clerkClient();
  const enrichedMembers = await Promise.all((members.data ?? []).map(async (m) => {
    try {
      const u = await client.users.getUser(m.user_id);
      return { ...m, name: `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim() || "—", email: u.emailAddresses[0]?.emailAddress ?? "", image_url: u.imageUrl };
    } catch {
      return { ...m, name: "Pending", email: "", image_url: null };
    }
  }));

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
    members: enrichedMembers,
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
  const admin = await requireAdminPerm("enterprise.manage");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { orgId } = await params;
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = {};
  for (const f of ["admin_notes", "status", "plan_label", "plan_id", "onboarding_done", "industry", "name",
    "contact_name", "contact_email", "contact_phone", "contact2_name", "contact2_email", "contact2_phone"]) {
    if (body[f] !== undefined) update[f] = body[f];
  }

  // Admin override for access gating: activate / comp / suspend a workspace.
  const ACCESS = ["pending", "active", "comped", "trialing", "past_due", "canceled"];
  if (typeof body.access_status === "string") {
    if (!ACCESS.includes(body.access_status)) {
      return NextResponse.json({ error: "Invalid access_status." }, { status: 400 });
    }
    update.access_status = body.access_status;
    update.activated_by = admin.userId;
    update.activated_at = ["active", "comped", "trialing"].includes(body.access_status)
      ? new Date().toISOString()
      : null;
  }

  const { data, error } = await supabaseAdmin.from("enterprise_orgs").update(update).eq("id", orgId).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
