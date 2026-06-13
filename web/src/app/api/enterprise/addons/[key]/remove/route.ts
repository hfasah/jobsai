import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

type Ctx = { params: Promise<{ key: string }> };

// Schedule an add-on for removal at the next renewal (not immediate, so running
// work — e.g. interviews — isn't cut off mid-cycle). We remove the Stripe
// subscription item now with NO proration (so it won't renew and the customer
// keeps what they already paid for), and keep the entitlement until the period
// end via org_addons.removal_at (getOrgEntitlements honors it).
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { key } = await params;

  const org = (await getMyOrg(userId)) as { id: string; stripe_subscription_id?: string | null } | null;
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data: feature } = await supabaseAdmin
    .from("features")
    .select("stripe_price_id")
    .eq("feature_key", key)
    .eq("is_addon", true)
    .maybeSingle();
  const priceId = (feature as { stripe_price_id?: string } | null)?.stripe_price_id;

  let removalAt: string | null = null;
  if (org.stripe_subscription_id && priceId) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
      const item = sub.items.data.find((i) => i.price.id === priceId);
      // dahlia API: the billing period lives on the subscription item.
      const periodEnd = (item ?? sub.items.data[0])?.current_period_end;
      removalAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
      // Mark scheduled BEFORE touching Stripe so the webhook doesn't cancel it.
      await supabaseAdmin
        .from("org_addons")
        .update({ status: "scheduled_removal", removal_at: removalAt })
        .eq("org_id", org.id)
        .eq("addon_key", key);
      if (item) await stripe.subscriptionItems.del(item.id, { proration_behavior: "none" });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Stripe error." }, { status: 500 });
    }
  } else {
    await supabaseAdmin.from("org_addons").update({ status: "canceled" }).eq("org_id", org.id).eq("addon_key", key);
  }

  return NextResponse.json({ ok: true, removal_at: removalAt });
}
