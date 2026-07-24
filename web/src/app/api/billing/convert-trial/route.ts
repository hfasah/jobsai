import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getUserBilling } from "@/lib/billing";
import { supabaseAdmin } from "@/lib/supabase";
import { convertTrialToPaid, getTokenBalance } from "@/lib/tokens";

// Convert-on-exhaustion: a trial user who has used their 500 credits and wants
// to keep going can end the trial early and start their paid plan NOW. Requires
// an explicit confirm on the client (this is a real charge). Ending the Stripe
// trial charges the card on file immediately; the full plan allowance is then
// granted (idempotent via convertTrialToPaid).

// GET — what the user would be charged if they convert now (for the confirm UI).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const billing = await getUserBilling(userId);
  if (billing.subscription_status !== "trialing" || !billing.stripe_subscription_id) {
    return NextResponse.json({ eligible: false });
  }
  try {
    const sub = await getStripe().subscriptions.retrieve(billing.stripe_subscription_id, { expand: ["items.data.price"] });
    const price = sub.items.data[0]?.price;
    return NextResponse.json({
      eligible: true,
      plan: billing.plan,
      amount: (price?.unit_amount ?? 0) / 100,
      currency: (price?.currency ?? "usd").toUpperCase(),
      interval: price?.recurring?.interval ?? "month",
    });
  } catch (err) {
    console.error("[convert-trial] preview failed:", err);
    return NextResponse.json({ eligible: false });
  }
}

// POST — end the trial now, charge the card, unlock the full plan.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const billing = await getUserBilling(userId);
  if (billing.subscription_status !== "trialing" || !billing.stripe_subscription_id) {
    return NextResponse.json({ error: "You're not on a trial." }, { status: 409 });
  }

  const stripe = getStripe();
  let updated;
  try {
    // trial_end "now" ends the trial and triggers the first invoice + charge.
    updated = await stripe.subscriptions.update(billing.stripe_subscription_id, {
      trial_end: "now",
      proration_behavior: "none",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not start your plan.";
    console.error("[convert-trial] stripe update failed:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // If the card charged cleanly, Stripe reports the sub as active. Reflect it
  // immediately + grant the allowance so the retry that follows sees the credits
  // (the trialing→active webhook is idempotent and no-ops on redelivery).
  if (updated.status === "active" || updated.status === "trialing") {
    // "trialing" here would mean the update didn't take; treat only active as success.
  }
  if (updated.status !== "active") {
    // Payment didn't clear (declined card, needs authentication, etc.).
    return NextResponse.json(
      { error: "We couldn't charge your card. Please update your payment method and try again.", status: updated.status },
      { status: 402 }
    );
  }

  await supabaseAdmin
    .from("user_billing")
    .update({ subscription_status: "active" })
    .eq("user_id", userId);
  await convertTrialToPaid(userId);

  const balance = await getTokenBalance(userId);
  return NextResponse.json({ ok: true, balance });
}
