import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  syncSubscriptionToOrg,
  markSubscriptionCanceled,
  linkCustomerToOrg,
} from "@/lib/enterprise-billing";
import { recordTrialFromSubscription } from "@/lib/enterprise-trial";
import type Stripe from "stripe";

// Enterprise billing webhook. Separate endpoint + secret from the consumer
// billing webhook so the two product lines stay isolated. Drives plan_id +
// access_status from Stripe subscription events.
export async function POST(req: NextRequest) {
  const body = await req.text(); // raw body — must not JSON-parse before verifying
  const sig = req.headers.get("stripe-signature") ?? "";
  const secret = process.env.STRIPE_ENTERPRISE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("STRIPE_ENTERPRISE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("Enterprise webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created": {
        const sub = event.data.object as Stripe.Subscription;
        await syncSubscriptionToOrg(sub);
        if (sub.status === "trialing") await recordTrialFromSubscription(sub);
        break;
      }
      case "customer.subscription.updated":
        await syncSubscriptionToOrg(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await markSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.org_id;
        if (orgId && session.customer) {
          const cust = typeof session.customer === "string" ? session.customer : session.customer.id;
          await linkCustomerToOrg(orgId, cust);
          if (session.subscription) {
            const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
            const sub = await getStripe().subscriptions.retrieve(subId);
            await syncSubscriptionToOrg(sub);
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error("Enterprise webhook handler error:", err);
    // 200 anyway so Stripe doesn't retry-storm on a transient DB hiccup.
  }

  return NextResponse.json({ received: true });
}
