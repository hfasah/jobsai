import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

// Cancellation reasons (Step 1) and the retention offer each one earns (Step 2).
export const CANCEL_REASONS = [
  "too_expensive",
  "missing_features",
  "not_hiring",
  "switching",
  "poor_experience",
  "just_testing",
  "other",
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number];

export type RetentionOffer = "discount_50_6mo" | "pause_90d" | "extend_trial_14d" | "book_demo" | null;

/** Which save offer fits a reason. Eligibility (trial state etc.) is checked server-side. */
export function offerForReason(reason: CancelReason): RetentionOffer {
  switch (reason) {
    case "too_expensive":
      return "discount_50_6mo";
    case "not_hiring":
      return "pause_90d";
    case "just_testing":
      return "extend_trial_14d";
    case "missing_features":
      return "book_demo";
    default:
      return null;
  }
}

type OrgBilling = {
  id: string;
  stripe_subscription_id: string | null;
  access_status: string | null;
  trial_extended: boolean | null;
};

async function getOrgBilling(orgId: string): Promise<OrgBilling | null> {
  const { data } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("id,stripe_subscription_id,access_status,trial_extended")
    .eq("id", orgId)
    .maybeSingle();
  return (data as OrgBilling | null) ?? null;
}

function subItemCurrentPeriodEnd(sub: { items: { data: { current_period_end?: number }[] } }): number | null {
  return (sub.items.data[0] as { current_period_end?: number } | undefined)?.current_period_end ?? null;
}

export type RetentionResult = { ok: true; message: string } | { ok: false; error: string };

/** Apply the save offer the customer accepted. Records the saved outcome. */
export async function applyRetention(
  orgId: string,
  userId: string,
  offer: RetentionOffer,
  reason: string,
): Promise<RetentionResult> {
  const org = await getOrgBilling(orgId);
  if (!org?.stripe_subscription_id) return { ok: false, error: "No active subscription to apply this to." };
  const stripe = getStripe();
  const subId = org.stripe_subscription_id;

  let message = "";
  let outcome = "";
  let orgUpdate: Record<string, unknown> = {};

  if (offer === "discount_50_6mo") {
    // 50% off for 6 months — never "forever" (that's reserved for founding customers).
    const coupon = await stripe.coupons.create({
      percent_off: 50,
      duration: "repeating",
      duration_in_months: 6,
      name: "Retention — 50% off 6 months",
    });
    await stripe.subscriptions.update(subId, { discounts: [{ coupon: coupon.id }] });
    message = "Done — 50% off for the next 6 months has been applied to your subscription.";
    outcome = "saved_discount";
    orgUpdate = { retention_offer: "discount_50_6mo" };
  } else if (offer === "pause_90d") {
    const resumesAt = Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60;
    await stripe.subscriptions.update(subId, {
      pause_collection: { behavior: "void", resumes_at: resumesAt },
    });
    message = "Your account is paused for 90 days. Your jobs, candidates, and reports are all kept.";
    outcome = "saved_pause";
    orgUpdate = { paused_until: new Date(resumesAt * 1000).toISOString(), retention_offer: "pause_90d" };
  } else if (offer === "extend_trial_14d") {
    if (org.access_status !== "trialing") return { ok: false, error: "Trial extensions are only available during a trial." };
    if (org.trial_extended) return { ok: false, error: "Your trial has already been extended once." };
    const sub = await stripe.subscriptions.retrieve(subId);
    const base = sub.trial_end && sub.trial_end > Date.now() / 1000 ? sub.trial_end : Math.floor(Date.now() / 1000);
    const newTrialEnd = base + 14 * 24 * 60 * 60;
    await stripe.subscriptions.update(subId, { trial_end: newTrialEnd, proration_behavior: "none" });
    message = "We've added 14 more days to your trial. No charge until then.";
    outcome = "saved_extend";
    orgUpdate = { trial_extended: true, trial_ends_at: new Date(newTrialEnd * 1000).toISOString() };
  } else if (offer === "book_demo") {
    // No billing change — we just record intent; the UI sends them to the demo page.
    message = "Great — let's get you set up with a product review.";
    outcome = "saved_demo";
  } else {
    return { ok: false, error: "No offer to apply." };
  }

  if (Object.keys(orgUpdate).length) {
    await supabaseAdmin.from("enterprise_orgs").update(orgUpdate).eq("id", orgId);
  }
  await supabaseAdmin
    .from("enterprise_cancellation_feedback")
    .insert({ org_id: orgId, user_id: userId, reason, outcome });

  return { ok: true, message };
}

/** Step 3 — schedule the cancellation at period end. Returns the access-end date. */
export async function scheduleCancellation(
  orgId: string,
  userId: string,
  reason: string,
  comment: string | null,
): Promise<{ ok: true; cancelAt: string | null } | { ok: false; error: string }> {
  const org = await getOrgBilling(orgId);
  if (!org?.stripe_subscription_id) return { ok: false, error: "No active subscription to cancel." };
  const stripe = getStripe();
  const sub = await stripe.subscriptions.update(org.stripe_subscription_id, { cancel_at_period_end: true });

  const endUnix = sub.cancel_at ?? subItemCurrentPeriodEnd(sub) ?? sub.trial_end ?? null;
  const cancelAt = endUnix ? new Date(endUnix * 1000).toISOString() : null;

  await supabaseAdmin
    .from("enterprise_orgs")
    .update({ cancel_at: cancelAt, cancel_reason: reason })
    .eq("id", orgId);
  await supabaseAdmin
    .from("enterprise_cancellation_feedback")
    .insert({ org_id: orgId, user_id: userId, reason, comment, outcome: "canceled" });

  return { ok: true, cancelAt };
}

/** Undo a scheduled cancellation or a pause. */
export async function resumeSubscription(
  orgId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const org = await getOrgBilling(orgId);
  if (!org?.stripe_subscription_id) return { ok: false, error: "No subscription found." };
  const stripe = getStripe();
  await stripe.subscriptions.update(org.stripe_subscription_id, {
    cancel_at_period_end: false,
    pause_collection: "",
  });
  await supabaseAdmin
    .from("enterprise_orgs")
    .update({ cancel_at: null, cancel_reason: null, paused_until: null })
    .eq("id", orgId);
  return { ok: true };
}
