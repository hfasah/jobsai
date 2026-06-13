import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyMembership } from "@/lib/enterprise";

export interface OrgEntitlements {
  planSlug: string | null;
  planName: string | null;
  accessStatus: string | null; // pending | trialing | active | past_due | canceled
  trialEndsAt: string | null;
  hasBilling: boolean; // org has a Stripe customer (can open the billing portal)
  features: string[]; // effective feature_keys (plan ∪ active add-ons ∪ overrides)
  limits: Record<string, number>; // -1 = unlimited
  addons: string[];
}

// Resolve everything an org's plan unlocks: plan features, active add-ons, and
// per-org overrides (which can grant OR explicitly deny a feature).
export async function getOrgEntitlements(orgId: string): Promise<OrgEntitlements> {
  const { data: orgRow } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("plan_id, access_status, trial_ends_at, stripe_customer_id")
    .eq("id", orgId)
    .maybeSingle();
  const org = orgRow as { plan_id?: string | null; access_status?: string | null; trial_ends_at?: string | null; stripe_customer_id?: string | null } | null;
  const planId = org?.plan_id ?? null;

  let planSlug: string | null = null;
  let planName: string | null = null;
  const features = new Set<string>();
  const limits: Record<string, number> = {};

  if (planId) {
    const { data: plan } = await supabaseAdmin
      .from("plans")
      .select("slug,name")
      .eq("id", planId)
      .maybeSingle();
    planSlug = (plan as { slug?: string } | null)?.slug ?? null;
    planName = (plan as { name?: string } | null)?.name ?? null;

    const { data: pf } = await supabaseAdmin
      .from("plan_features")
      .select("features(feature_key)")
      .eq("plan_id", planId);
    for (const row of (pf ?? []) as { features?: { feature_key?: string } | null }[]) {
      const key = row.features?.feature_key;
      if (key) features.add(key);
    }

    const { data: pl } = await supabaseAdmin
      .from("plan_limits")
      .select("limit_key,value")
      .eq("plan_id", planId);
    for (const row of (pl ?? []) as { limit_key: string; value: number }[]) {
      limits[row.limit_key] = row.value;
    }
  }

  const addons: string[] = [];
  const { data: ad } = await supabaseAdmin
    .from("org_addons")
    .select("addon_key")
    .eq("org_id", orgId)
    .eq("status", "active");
  for (const row of (ad ?? []) as { addon_key: string }[]) {
    addons.push(row.addon_key);
    features.add(row.addon_key);
  }

  const { data: ov } = await supabaseAdmin
    .from("org_feature_overrides")
    .select("feature_key,enabled")
    .eq("org_id", orgId);
  for (const row of (ov ?? []) as { feature_key: string; enabled: boolean }[]) {
    if (row.enabled) features.add(row.feature_key);
    else features.delete(row.feature_key);
  }

  return {
    planSlug,
    planName,
    accessStatus: org?.access_status ?? null,
    trialEndsAt: org?.trial_ends_at ?? null,
    hasBilling: !!org?.stripe_customer_id,
    features: [...features],
    limits,
    addons,
  };
}

// True if the org's plan (or add-on/override) includes the feature. Fails OPEN
// on any error so a transient/pre-migration failure never breaks the app.
export async function hasFeature(orgId: string, featureKey: string): Promise<boolean> {
  try {
    const ent = await getOrgEntitlements(orgId);
    return ent.features.includes(featureKey);
  } catch {
    return true;
  }
}

// Route guard (entitlement layer). Returns a 401/403 NextResponse to return
// early, or null when the caller's org is entitled to `featureKey`. Compose
// with requirePermission (RBAC) and the access-status gate. Usage:
//   const gate = await requireFeature(userId, "white_label");
//   if (gate) return gate;
export async function requireFeature(
  userId: string | null,
  featureKey: string,
): Promise<NextResponse | null> {
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const member = await getMyMembership(userId);
  if (!member) {
    return NextResponse.json({ error: "Not an enterprise member." }, { status: 403 });
  }
  let allowed = true;
  try {
    allowed = await hasFeature(member.org_id, featureKey);
  } catch {
    allowed = true; // fail open
  }
  if (!allowed) {
    return NextResponse.json(
      { error: "Your plan does not include this feature.", feature: featureKey, upgrade: true },
      { status: 403 },
    );
  }
  return null;
}
