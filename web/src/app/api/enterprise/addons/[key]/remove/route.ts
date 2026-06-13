import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

type Ctx = { params: Promise<{ key: string }> };

// Remove an add-on: deletes its Stripe subscription item; marks org_addons
// canceled immediately (webhook reconciles too).
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

  if (org.stripe_subscription_id && priceId) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
      const item = sub.items.data.find((i) => i.price.id === priceId);
      if (item) await stripe.subscriptionItems.del(item.id, { proration_behavior: "create_prorations" });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Stripe error." }, { status: 500 });
    }
  }

  await supabaseAdmin
    .from("org_addons")
    .update({ status: "canceled" })
    .eq("org_id", org.id)
    .eq("addon_key", key);

  return NextResponse.json({ ok: true });
}
