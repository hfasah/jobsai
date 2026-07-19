import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminPerm } from "@/lib/admin";
import { getOrgEntitlements } from "@/lib/enterprise-entitlements";

type Ctx = { params: Promise<{ orgId: string }> };

// Every feature_key the workspace nav gates on, so the demo never hides an item
// just because the features catalog is missing a row. Unioned with the catalog.
const NAV_FEATURE_KEYS = [
  "hiring_manager_workspace", "ai_sourcing", "outreach_campaigns", "recruiting_agent",
  "workflow_automation", "executive_analytics", "client_reporting", "compliance_gdpr",
  "ats_integration", "ai_interviews", "sms_whatsapp", "white_label", "white_label_plus",
];

const ADDONS = ["ai_interviews", "recruiting_agent", "sms_whatsapp", "white_label_plus"];

// POST — turn an org into a fully-loaded demo: Enterprise plan, comped access,
// EVERY feature granted via overrides, and all paid add-ons active. Grants
// overrides for both plan-tier and add-on features so the sidebar can't depend
// on plan_features or org_addons writes succeeding. Deliberately separate from
// the generic "Open as-is" so we never hand a real customer free features.
export async function POST(_req: NextRequest, { params }: Ctx) {
  const admin = await requireAdminPerm("enterprise.manage");
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { orgId } = await params;

  const { data: org } = await supabaseAdmin.from("enterprise_orgs").select("id").eq("id", orgId).maybeSingle();
  if (!org) return NextResponse.json({ error: "Org not found." }, { status: 404 });

  const errors: string[] = [];

  // 1. Enterprise plan (fall back to the highest priced plan) + comped access.
  const { data: plans } = await supabaseAdmin.from("plans").select("id, slug, price_monthly");
  const enterprise = (plans ?? []).find((p) => p.slug === "enterprise")
    ?? (plans ?? []).slice().sort((a, b) => (b.price_monthly ?? 0) - (a.price_monthly ?? 0))[0];
  const orgUpdate: Record<string, unknown> = {
    access_status: "comped",
    activated_by: admin.userId,
    activated_at: new Date().toISOString(),
  };
  if (enterprise?.id) orgUpdate.plan_id = enterprise.id;
  else errors.push("No plans found — plan not set.");
  const { error: orgErr } = await supabaseAdmin.from("enterprise_orgs").update(orgUpdate).eq("id", orgId);
  if (orgErr) errors.push(`plan/access: ${orgErr.message}`);

  // 2. Grant EVERY feature via overrides (catalog ∪ nav keys).
  const { data: feats } = await supabaseAdmin.from("features").select("feature_key");
  const featureKeys = Array.from(new Set([
    ...(feats ?? []).map((f) => f.feature_key),
    ...NAV_FEATURE_KEYS,
  ]));
  const { error: ovErr } = await supabaseAdmin.from("org_feature_overrides").upsert(
    featureKeys.map((feature_key) => ({
      org_id: orgId, feature_key, enabled: true, note: "demo: full access", created_by: admin.userId,
    })),
    { onConflict: "org_id,feature_key" },
  );
  if (ovErr) errors.push(`features: ${ovErr.message}`);

  // 3. Activate all paid add-ons (so the Add-ons/Billing pages show them owned).
  const { error: adErr } = await supabaseAdmin.from("org_addons").upsert(
    ADDONS.map((addon_key) => ({ org_id: orgId, addon_key, status: "active" })),
    { onConflict: "org_id,addon_key" },
  );
  if (adErr) errors.push(`addons: ${adErr.message}`);

  // Read back exactly what the workspace will now resolve for this org, so the
  // caller (and we) can see the real result instead of trusting the writes.
  const ent = await getOrgEntitlements(orgId).catch(() => null);
  const snapshot = {
    plan: ent?.planSlug ?? enterprise?.slug ?? null,
    access: ent?.accessStatus ?? null,
    features: ent?.features.length ?? 0,
    addons: ent?.addons.length ?? 0,
  };

  if (errors.length) {
    return NextResponse.json({ error: errors.join(" · "), snapshot }, { status: 500 });
  }
  // A healthy full demo should resolve to the Enterprise plan with many features.
  if (snapshot.plan !== "enterprise" || snapshot.features < 5) {
    return NextResponse.json(
      { error: `Grant ran but the org still resolves to plan=${snapshot.plan}, ${snapshot.features} features. The plan row may be missing in this database.`, snapshot },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, snapshot });
}
