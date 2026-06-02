import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getUserBilling } from "@/lib/billing";
import { supabaseAdmin } from "@/lib/supabase";
import type { Plan } from "@/lib/billing";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// POST /api/billing/checkout
// Body: { plan: "pro" | "business" }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const plan = body.plan as "pro" | "business" | undefined;

  if (!plan || !["pro", "business"].includes(plan)) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  const priceId =
    plan === "pro"
      ? process.env.STRIPE_PRO_PRICE_ID
      : process.env.STRIPE_BUSINESS_PRICE_ID;

  if (!priceId) {
    return NextResponse.json(
      { error: `STRIPE_${plan.toUpperCase()}_PRICE_ID is not configured.` },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const billing = await getUserBilling(userId);

  // Reuse existing Stripe customer if available
  let customerId = billing.stripe_customer_id ?? undefined;

  if (!customerId) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses[0]?.emailAddress;

    const customer = await stripe.customers.create({
      email,
      metadata: { clerk_user_id: userId },
    });
    customerId = customer.id;

    // Persist the customer ID immediately so concurrent requests don't create duplicates
    await supabaseAdmin
      .from("user_billing")
      .upsert({ user_id: userId, stripe_customer_id: customerId }, { onConflict: "user_id" });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/dashboard/billing?success=true`,
    cancel_url: `${APP_URL}/dashboard/billing?canceled=true`,
    allow_promotion_codes: true,
    metadata: { clerk_user_id: userId, plan },
  });

  return NextResponse.json({ url: session.url });
}
