import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { loadCatalog } from "@/lib/enterprise-catalog";
import { getOrgEntitlements } from "@/lib/enterprise-entitlements";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ orgId: string }> };

// GET — the org's plan + every catalog feature with: whether the plan includes
// it, the admin override state (on/off/null), and the effective result. Drives
// the admin "Plan & feature access" panel.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { orgId } = await params;

  const { data: org } = await supabaseAdmin.from("enterprise_orgs").select("id").eq("id", orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: "Org not found." }, { status: 404 });

  const [catalog, ent, { data: ovRows }] = await Promise.all([
    loadCatalog(),
    getOrgEntitlements(orgId),
    supabaseAdmin.from("org_feature_overrides").select("feature_key,enabled").eq("org_id", orgId),
  ]);

  const overrides = new Map((ovRows ?? []).map((r) => [r.feature_key, r.enabled as boolean]));
  const planSlug = ent.planSlug;

  const inPlan = (key: string, isAddon: boolean): boolean => {
    if (isAddon) return false; // add-ons are purchased separately, never in a plan
    if (planSlug === "enterprise") return true; // Enterprise = all plan features
    return (catalog.planFeatures[planSlug ?? ""] ?? []).includes(key);
  };

  const features = catalog.features.map((f) => ({
    key: f.feature_key,
    name: f.name,
    category: f.category,
    is_addon: f.is_addon,
    inPlan: inPlan(f.feature_key, f.is_addon),
    override: overrides.has(f.feature_key) ? overrides.get(f.feature_key)! : null,
    effective: ent.features.includes(f.feature_key),
  }));

  return NextResponse.json({
    data: {
      planSlug,
      planName: ent.planName,
      plans: catalog.plans.map((p) => ({ slug: p.slug, name: p.name })),
      features,
      addons: ent.addons,
    },
  });
}

// PATCH — switch the org's plan and/or set a single feature override.
//   { plan_slug }                         → change plan
//   { feature_key, state: "on"|"off"|"default" } → force on / force off / clear
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { orgId } = await params;
  const body = await req.json().catch(() => ({}));

  if (typeof body.plan_slug === "string") {
    const { data: plan } = await supabaseAdmin.from("plans").select("id").eq("slug", body.plan_slug).maybeSingle();
    if (!plan) return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
    const { error } = await supabaseAdmin.from("enterprise_orgs").update({ plan_id: plan.id }).eq("id", orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (typeof body.feature_key === "string" && typeof body.state === "string") {
    if (body.state === "default") {
      await supabaseAdmin.from("org_feature_overrides").delete().eq("org_id", orgId).eq("feature_key", body.feature_key);
    } else if (body.state === "on" || body.state === "off") {
      const { error } = await supabaseAdmin.from("org_feature_overrides").upsert(
        { org_id: orgId, feature_key: body.feature_key, enabled: body.state === "on", note: "admin", created_by: admin.userId },
        { onConflict: "org_id,feature_key" },
      );
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      return NextResponse.json({ error: "Invalid state." }, { status: 400 });
    }
  }

  // Return the refreshed effective entitlements so the UI updates immediately.
  const ent = await getOrgEntitlements(orgId);
  return NextResponse.json({ data: { planSlug: ent.planSlug, planName: ent.planName, effective: ent.features } });
}
