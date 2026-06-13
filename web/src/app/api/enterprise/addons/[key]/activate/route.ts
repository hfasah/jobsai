import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

type Ctx = { params: Promise<{ key: string }> };

// One-click add-on activation: adds (or, for per-seat add-ons, sets quantity on)
// a Stripe subscription item on the org's live subscription. The webhook
// reconciles too; we also update org_addons immediately for instant UI.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { key } = await params;

  const org = (await getMyOrg(userId)) as { id: string; stripe_subscription_id?: string | null } | null;
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  if (!org.stripe_subscription_id) {
    return NextResponse.json({ error: "Start a plan first.", redirect: "/enterprise/plans" }, { status: 400 });
  }

  const { data: feature } = await supabaseAdmin
    .from("features")
    .select("stripe_price_id")
    .eq("feature_key", key)
    .eq("is_addon", true)
    .maybeSingle();
  const priceId = (feature as { stripe_price_id?: string } | null)?.stripe_price_id;
  if (!priceId) return NextResponse.json({ error: "Add-on not available." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as { quantity?: number };
  const quantity = key === "extra_recruiter" ? Math.max(1, Math.floor(body.quantity ?? 1)) : 1;

  const stripe = getStripe();
  try {
    const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id);
    const existing = sub.items.data.find((i) => i.price.id === priceId);
    if (existing) {
      if (existing.quantity !== quantity) {
        await stripe.subscriptionItems.update(existing.id, { quantity, proration_behavior: "create_prorations" });
      }
    } else {
      await stripe.subscriptionItems.create({
        subscription: org.stripe_subscription_id,
        price: priceId,
        quantity,
        proration_behavior: "create_prorations",
      });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Stripe error." }, { status: 500 });
  }

  // Instant local update (webhook will also reconcile).
  await supabaseAdmin
    .from("org_addons")
    .upsert({ org_id: org.id, addon_key: key, status: "active", quantity }, { onConflict: "org_id,addon_key" });

  return NextResponse.json({ ok: true });
}
