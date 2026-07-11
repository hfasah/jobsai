import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  syncSubscriptionToOrg,
  markSubscriptionCanceled,
  linkCustomerToOrg,
} from "@/lib/enterprise-billing";
import { recordTrialFromSubscription } from "@/lib/enterprise-trial";
import {
  recordCommissionForInvoice,
  reverseCommissionForInvoice,
  cancelReferralForCustomer,
} from "@/lib/partner-commissions";
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
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await markSubscriptionCanceled(sub);
        // Stop future partner commissions for this customer's referral.
        const cust = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
        if (cust) await cancelReferralForCustomer(cust);
        break;
      }
      // Partner commission engine: pay on collected revenue, reverse on refund.
      case "invoice.paid":
        await recordCommissionForInvoice(event.data.object as Stripe.Invoice);
        break;
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        // `invoice` is present at runtime but dropped from the Charge type in
        // this API version, so read it through a narrow cast.
        const inv = (charge as unknown as { invoice?: string | { id: string } | null }).invoice;
        const invoiceId = typeof inv === "string" ? inv : inv?.id;
        if (invoiceId) await reverseCommissionForInvoice(invoiceId);
        break;
      }
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
        // Sourcing credit-pack top-up (one-time payment). Idempotent per
        // session id via the sourcing_purchase_once partial unique index —
        // a webhook retry rolls back inside sourcing_grant_credits.
        const credits = parseInt(session.metadata?.sourcing_credits ?? "", 10);
        if (orgId && Number.isFinite(credits) && credits > 0 && session.payment_status === "paid") {
          const { supabaseAdmin } = await import("@/lib/supabase");
          await supabaseAdmin.rpc("sourcing_grant_credits", {
            p_org: orgId,
            p_amount: credits,
            p_reason: "purchase",
            p_period: session.id,
            p_ref_type: "purchase",
            p_ref_id: null,
            p_user: null,
          });
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
