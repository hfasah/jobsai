import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getUserBilling } from "@/lib/billing";
import { supabaseAdmin } from "@/lib/supabase";

// Retention ladder coupons: offered in the cancel flow as 30% off (first rung)
// then 50% off (final offer), both for 2 months. One redemption per customer
// per 12 months — enforced here, not in the UI.

const COUPONS: Record<"30" | "50", { id: string; percent: number; months: number; name: string }> = {
  "30": { id: "jobsai-retain-30-2mo", percent: 30, months: 2, name: "JobsAI Retention — 30% off for 2 months" },
  "50": { id: "jobsai-retain-50-2mo", percent: 50, months: 2, name: "JobsAI Retention — 50% off for 2 months" },
};

const TWELVE_MONTHS_MS = 365 * 24 * 60 * 60 * 1000;

async function getOrCreateCoupon(tier: "30" | "50"): Promise<string> {
  const spec = COUPONS[tier];
  const stripe = getStripe();
  try {
    const existing = await stripe.coupons.retrieve(spec.id);
    return existing.id;
  } catch {
    const coupon = await stripe.coupons.create({
      id: spec.id,
      percent_off: spec.percent,
      duration: "repeating",
      duration_in_months: spec.months,
      name: spec.name,
    });
    return coupon.id;
  }
}

async function isEligible(userId: string): Promise<{ eligible: boolean; reason?: string }> {
  const { data, error } = await supabaseAdmin
    .from("user_billing")
    .select("retention_offer_at, stripe_subscription_id, subscription_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[retention-offer] eligibility query failed:", error.message);
    return { eligible: false, reason: "lookup_failed" }; // fail closed
  }
  if (!data?.stripe_subscription_id || !["active", "trialing", "past_due"].includes(data.subscription_status ?? "")) {
    return { eligible: false, reason: "no_active_subscription" };
  }
  if (data.retention_offer_at && Date.now() - new Date(data.retention_offer_at).getTime() < TWELVE_MONTHS_MS) {
    return { eligible: false, reason: "already_used" };
  }
  return { eligible: true };
}

// GET — is this customer eligible for the retention discounts?
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await isEligible(userId);
  return NextResponse.json(result);
}

// POST { tier: "30" | "50" } — apply the discount to the active subscription.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tier: "30" | "50" = body.tier === "50" ? "50" : "30";

  const eligibility = await isEligible(userId);
  if (!eligibility.eligible) {
    return NextResponse.json({ error: "This offer isn't available on your account right now." }, { status: 409 });
  }

  const billing = await getUserBilling(userId);
  if (!billing.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription." }, { status: 409 });
  }

  try {
    const stripe = getStripe();
    const couponId = await getOrCreateCoupon(tier);
    await stripe.subscriptions.update(billing.stripe_subscription_id, {
      discounts: [{ coupon: couponId }],
    });
    const { error: recordError } = await supabaseAdmin
      .from("user_billing")
      .update({ retention_offer_at: new Date().toISOString(), retention_offer_coupon: couponId })
      .eq("user_id", userId);
    if (recordError) console.error("[retention-offer] usage record failed:", recordError.message);
    return NextResponse.json({ ok: true, tier });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to apply discount.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
