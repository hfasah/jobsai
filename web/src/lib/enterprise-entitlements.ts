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

    // The Enterprise tier is "custom" and ships every plan-tier capability, so it
    // has no plan_features rows. Treat it as all non-add-on features by definition
    // (add-ons stay separately purchased via org_addons, even on Enterprise).
    if (planSlug === "enterprise") {
      const { data: allFeats } = await supabaseAdmin.from("features").select("feature_key, is_addon");
      for (const f of (allFeats ?? []) as { feature_key?: string; is_addon?: boolean }[]) {
        if (f.feature_key && !f.is_addon) features.add(f.feature_key);
      }
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
  let extraRecruiters = 0;
  const { data: ad } = await supabaseAdmin
    .from("org_addons")
    .select("addon_key, quantity, status, removal_at")
    .eq("org_id", orgId)
    .in("status", ["active", "scheduled_removal"]);
  const now = Date.now();
  for (const row of (ad ?? []) as { addon_key: string; quantity?: number; status: string; removal_at?: string | null }[]) {
    // Scheduled-for-removal add-ons keep their feature until the renewal date.
    if (row.status === "scheduled_removal" && (!row.removal_at || new Date(row.removal_at).getTime() <= now)) continue;
    addons.push(row.addon_key);
    features.add(row.addon_key);
    if (row.addon_key === "extra_recruiter") extraRecruiters += row.quantity ?? 0;
  }
  // Purchased extra recruiter seats raise the plan's recruiter limit.
  if (extraRecruiters > 0 && typeof limits.recruiters === "number" && limits.recruiters >= 0) {
    limits.recruiters += extraRecruiters;
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
