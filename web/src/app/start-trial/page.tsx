import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserBilling } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { StartTrialClient } from "@/components/start-trial-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Start your free trial | JobsAI",
  description: "7-day free trial with 500 credits. Credit card required; cancel anytime before day 7 and you won't be charged.",
};

// Card-required gate: every job-seeker account needs an active or trialing
// subscription to use the dashboard. This page is where new signups land —
// pick a plan, add a card, get a 7-day trial with 500 credits. Lapsed/canceled
// accounts land here too and see resubscribe copy (one trial per customer,
// verified against Stripe's subscription history).
export default async function StartTrialPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const billing = await getUserBilling(userId);
  if (["active", "trialing", "past_due"].includes(billing.subscription_status ?? "")) {
    redirect("/dashboard");
  }

  let trialEligible = true;
  if (billing.stripe_customer_id) {
    try {
      const prev = await getStripe().subscriptions.list({ customer: billing.stripe_customer_id, status: "all", limit: 1 });
      trialEligible = prev.data.length === 0;
    } catch {
      // Stripe hiccup → default to eligible; checkout re-verifies authoritatively.
      trialEligible = true;
    }
  }

  return <StartTrialClient trialEligible={trialEligible} />;
}
