import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import type Stripe from "stripe";

// Stripe sends the raw body — must NOT parse as JSON before signature check
export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(sub);
        break;
      }
    }
  } catch (err) {
    console.error(`Webhook handler error for ${event.type}:`, err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.clerk_user_id;
  const plan = session.metadata?.plan as "pro" | "business" | undefined;
  if (!userId || !plan) return;

  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) return;

  const stripe = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);

  await supabaseAdmin.from("user_billing").upsert(
    {
      user_id: userId,
      plan,
      stripe_customer_id: customerId ?? null,
      stripe_subscription_id: subscriptionId,
      subscription_status: sub.status,
      current_period_end: null, // field removed in Stripe API 2026
    },
    { onConflict: "user_id" }
  );
}

async function handleSubscriptionChange(sub: Stripe.Subscription) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const { data: billing } = await supabaseAdmin
    .from("user_billing")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (!billing?.user_id) return;

  // Derive plan from price ID
  const priceId = sub.items.data[0]?.price?.id;
  let plan: "pro" | "business" = "pro";
  if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) plan = "business";

  await supabaseAdmin
    .from("user_billing")
    .update({
      plan,
      subscription_status: sub.status,
    })
    .eq("user_id", billing.user_id);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const customerId =
    typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const { data: billing } = await supabaseAdmin
    .from("user_billing")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (!billing?.user_id) return;

  await supabaseAdmin
    .from("user_billing")
    .update({
      plan: "free",
      subscription_status: "canceled",
      stripe_subscription_id: null,
    })
    .eq("user_id", billing.user_id);
}
