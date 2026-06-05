import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  getUserBilling, getPlanPriceId, TOKEN_PACK_PRICE_IDS,
  type PaidPlan, type BillingInterval,
} from "@/lib/billing";
import { TOKEN_PACKS } from "@/lib/tokens";
import { supabaseAdmin } from "@/lib/supabase";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const PAID_PLANS: PaidPlan[] = ["pro", "premium", "accelerator"];

// Supported presentment currencies. Stripe Adaptive Pricing must be enabled in
// your Stripe Dashboard (Settings → Billing → Adaptive pricing) for the
// currency selector to appear in the checkout sheet.
const SUPPORTED_CURRENCIES = new Set(["usd", "cad", "gbp", "eur"]);

function parseCurrency(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const c = raw.toLowerCase();
  return SUPPORTED_CURRENCIES.has(c) ? c : undefined;
}

// Ensures the user has a Stripe customer, creating + persisting one if needed.
async function ensureCustomer(userId: string): Promise<string> {
  const billing = await getUserBilling(userId);
  if (billing.stripe_customer_id) return billing.stripe_customer_id;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email = user.emailAddresses[0]?.emailAddress;

  const customer = await getStripe().customers.create({
    email,
    metadata: { clerk_user_id: userId },
  });
  await supabaseAdmin
    .from("user_billing")
    .upsert({ user_id: userId, stripe_customer_id: customer.id }, { onConflict: "user_id" });
  return customer.id;
}

// POST /api/billing/checkout
//  • subscription: { plan: "pro"|"premium"|"accelerator", interval?: "monthly"|"yearly" }
//  • token top-up:  { pack: "pack_5k"|"pack_20k"|"pack_60k" }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const stripe = getStripe();
  const currency = parseCurrency(body.currency);

  // ── Token pack (one-time payment) ──────────────────────────────────────────
  if (body.pack) {
    const pack = TOKEN_PACKS.find((p) => p.id === body.pack);
    const priceId = TOKEN_PACK_PRICE_IDS[body.pack];
    if (!pack) return NextResponse.json({ error: "Invalid pack." }, { status: 400 });
    if (!priceId) {
      return NextResponse.json({ error: `Stripe price for ${body.pack} is not configured.` }, { status: 500 });
    }

    const customerId = await ensureCustomer(userId);
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      ...(currency ? { currency } : {}),
      success_url: `${APP_URL}/dashboard/billing?topup=true`,
      cancel_url: `${APP_URL}/dashboard/billing?canceled=true`,
      metadata: { clerk_user_id: userId, token_pack: pack.id, tokens: String(pack.tokens) },
    });
    return NextResponse.json({ url: session.url });
  }

  // ── Subscription ─────────────────────────────────────────────────────────────
  const plan = body.plan as PaidPlan | undefined;
  const interval: BillingInterval = body.interval === "yearly" ? "yearly" : "monthly";

  if (!plan || !PAID_PLANS.includes(plan)) {
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  const priceId = getPlanPriceId(plan, interval);
  if (!priceId) {
    return NextResponse.json(
      { error: `Stripe price for ${plan} (${interval}) is not configured.` },
      { status: 500 }
    );
  }

  const customerId = await ensureCustomer(userId);
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    ...(currency ? { currency } : {}),
    success_url: `${APP_URL}/onboarding/success`,
    cancel_url: `${APP_URL}/dashboard/billing?canceled=true`,
    allow_promotion_codes: true,
    metadata: { clerk_user_id: userId, plan, interval },
  });
  return NextResponse.json({ url: session.url });
}
