import { supabaseAdmin } from "@/lib/supabase";
import type Stripe from "stripe";

// Map a Stripe subscription status to our org access_status.
function accessFromStatus(status: string): string {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due" || status === "unpaid") return "past_due";
  return "canceled"; // canceled, incomplete_expired, paused, …
}

function customerId(sub: Stripe.Subscription): string {
  return typeof sub.customer === "string" ? sub.customer : sub.customer.id;
}

// Reconcile an org's plan / access / add-ons from a Stripe subscription.
// Looks up plan + add-on by the subscription's price IDs (stored on plans /
// features by the setup script), so there's no env-var price mapping.
export async function syncSubscriptionToOrg(sub: Stripe.Subscription): Promise<void> {
  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("id")
    .eq("stripe_customer_id", customerId(sub))
    .maybeSingle();
  if (!org) return; // unknown customer (org not linked yet)
  const orgId = (org as { id: string }).id;

  const priceIds = sub.items.data.map((i) => i.price.id);

  // Base plan
  const { data: planRows } = await supabaseAdmin
    .from("plans")
    .select("id,stripe_price_id")
    .in("stripe_price_id", priceIds);
  const planId = (planRows as { id: string }[] | null)?.[0]?.id ?? null;

  const update: Record<string, unknown> = {
    stripe_subscription_id: sub.id,
    access_status: accessFromStatus(sub.status),
  };
  if (planId) {
    update.plan_id = planId;
    update.activated_at = new Date().toISOString();
  }
  await supabaseAdmin.from("enterprise_orgs").update(update).eq("id", orgId);

  // Add-ons: features flagged is_addon whose price is on the subscription.
  const { data: addonFeatures } = await supabaseAdmin
    .from("features")
    .select("feature_key,stripe_price_id")
    .eq("is_addon", true)
    .in("stripe_price_id", priceIds);
  const activeKeys = new Set((addonFeatures as { feature_key: string }[] | null ?? []).map((f) => f.feature_key));

  for (const key of activeKeys) {
    await supabaseAdmin
      .from("org_addons")
      .upsert({ org_id: orgId, addon_key: key, status: "active" }, { onConflict: "org_id,addon_key" });
  }

  // Cancel add-ons that dropped off the subscription.
  const { data: current } = await supabaseAdmin
    .from("org_addons")
    .select("addon_key")
    .eq("org_id", orgId)
    .eq("status", "active");
  for (const a of (current as { addon_key: string }[] | null ?? [])) {
    if (!activeKeys.has(a.addon_key)) {
      await supabaseAdmin
        .from("org_addons")
        .update({ status: "canceled" })
        .eq("org_id", orgId)
        .eq("addon_key", a.addon_key);
    }
  }
}

export async function markSubscriptionCanceled(sub: Stripe.Subscription): Promise<void> {
  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("id")
    .eq("stripe_customer_id", customerId(sub))
    .maybeSingle();
  if (!org) return;
  const orgId = (org as { id: string }).id;
  await supabaseAdmin.from("enterprise_orgs").update({ access_status: "canceled" }).eq("id", orgId);
  await supabaseAdmin.from("org_addons").update({ status: "canceled" }).eq("org_id", orgId);
}

// Link a Stripe customer to an org (from checkout metadata) before syncing.
export async function linkCustomerToOrg(orgId: string, stripeCustomerId: string): Promise<void> {
  await supabaseAdmin
    .from("enterprise_orgs")
    .update({ stripe_customer_id: stripeCustomerId })
    .eq("id", orgId);
}
