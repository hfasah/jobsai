import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { hasUsedTrial } from "@/lib/enterprise-trial";

// Start a subscription checkout (14-day trial) for the caller's org + chosen
// plan. The webhook (/api/enterprise/stripe/webhook) flips the org to
// trialing/active once Stripe confirms.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = (await getMyOrg(userId)) as
    | ({ id: string; name: string; stripe_customer_id?: string | null })
    | null;
  if (!org) return NextResponse.json({ error: "Create your workspace first." }, { status: 404 });

  const { plan_slug } = (await req.json().catch(() => ({}))) as { plan_slug?: string };
  if (!plan_slug) return NextResponse.json({ error: "plan_slug is required." }, { status: 400 });
  if (plan_slug === "enterprise") {
    return NextResponse.json({ error: "The Enterprise plan is sales-led — book a demo." }, { status: 400 });
  }

  const { data: plan } = await supabaseAdmin
    .from("plans")
    .select("name,stripe_price_id")
    .eq("slug", plan_slug)
    .maybeSingle();
  const priceId = (plan as { stripe_price_id?: string } | null)?.stripe_price_id;
  if (!priceId) {
    return NextResponse.json({ error: "This plan isn't available for checkout yet." }, { status: 400 });
  }

  const stripe = getStripe();

  const client = await clerkClient();
  const user = await client.users.getUser(userId).catch(() => null);
  const email = user?.emailAddresses?.[0]?.emailAddress ?? null;

  // Reuse or create the Stripe customer for this org.
  let customerId = org.stripe_customer_id ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: email ?? undefined,
      name: org.name,
      metadata: { org_id: org.id },
    });
    customerId = customer.id;
    await supabaseAdmin.from("enterprise_orgs").update({ stripe_customer_id: customerId }).eq("id", org.id);
  }

  // One free trial per company — block a second trial by email / customer / domain.
  const trialUsed = await hasUsedTrial({ email, customerId });

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work").replace(/\/$/, "");
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: trialUsed
      ? { metadata: { org_id: org.id } }
      : { trial_period_days: 14, metadata: { org_id: org.id } },
    allow_promotion_codes: true, // lets founding customers apply the coupon
    success_url: `${base}/enterprise/dashboard?welcome=1`,
    cancel_url: `${base}/enterprise/plans`,
    metadata: { org_id: org.id },
  });

  return NextResponse.json({ url: session.url });
}
