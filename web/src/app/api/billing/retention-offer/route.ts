import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getUserBilling } from "@/lib/billing";

const COUPON_ID = process.env.STRIPE_RETENTION_COUPON_ID ?? "jobsai-retention-30off-3mo";

async function getOrCreateCoupon(): Promise<string> {
  const stripe = getStripe();
  try {
    const existing = await stripe.coupons.retrieve(COUPON_ID);
    return existing.id;
  } catch {
    const coupon = await stripe.coupons.create({
      id: COUPON_ID,
      percent_off: 30,
      duration: "repeating",
      duration_in_months: 3,
      name: "JobsAI Retention — 30% off for 3 months",
    });
    return coupon.id;
  }
}

// POST /api/billing/retention-offer
// Applies a 30% off for 3 months coupon to the user's active subscription.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const billing = await getUserBilling(userId);
  if (!billing.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription." }, { status: 409 });
  }

  try {
    const stripe = getStripe();
    const couponId = await getOrCreateCoupon();
    await stripe.subscriptions.update(billing.stripe_subscription_id, {
      discounts: [{ coupon: couponId }],
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to apply discount.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
