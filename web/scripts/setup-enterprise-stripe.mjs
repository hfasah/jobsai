/**
 * Creates JobsAI Enterprise products + prices + the Founding Customer coupon in
 * Stripe, then writes the resulting IDs back onto the plans/features rows so the
 * webhook can map a subscription price → plan/add-on with no env vars.
 *
 * Prereqs: run migrations 083 + 084 first (plans/features tables + stripe_* cols).
 * Usage:   node scripts/setup-enterprise-stripe.mjs
 *          (reads STRIPE_SECRET_KEY + SUPABASE creds from web/.env.local)
 *
 * Idempotent: skips any plan/add-on that already has a stripe_price_id, and
 * reuses a fixed coupon id, so re-running won't create duplicates.
 */
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error("Set STRIPE_SECRET_KEY in .env.local"); process.exit(1); }
console.log(key.startsWith("sk_live_") ? "🔴 LIVE mode" : "🧪 TEST mode");

const stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function ensurePrice({ name, description, amount, metadata }) {
  const product = await stripe.products.create({ name, description, metadata });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: Math.round(amount * 100),
    currency: "usd",
    recurring: { interval: "month" },
    metadata,
  });
  console.log(`  ✓ ${name}: $${amount}/mo → ${price.id}`);
  return { productId: product.id, priceId: price.id };
}

// ── Plans (self-serve; Enterprise is custom/sales-led → no price) ───────────
console.log("\nPlans");
const { data: plans } = await sb.from("plans").select("slug,name,price_monthly,stripe_price_id").order("sort_order");
for (const p of plans ?? []) {
  if (p.price_monthly == null) { console.log(`  – ${p.name}: custom, skipped`); continue; }
  if (p.stripe_price_id) { console.log(`  ~ ${p.name}: already has price, skipped`); continue; }
  const { productId, priceId } = await ensurePrice({
    name: `JobsAI Enterprise — ${p.name}`,
    description: `${p.name} plan`,
    amount: Number(p.price_monthly),
    metadata: { kind: "plan", plan_slug: p.slug },
  });
  await sb.from("plans").update({ stripe_product_id: productId, stripe_price_id: priceId }).eq("slug", p.slug);
}

// ── Add-ons ─────────────────────────────────────────────────────────────────
console.log("\nAdd-ons");
const { data: addons } = await sb.from("features").select("feature_key,name,price_monthly,stripe_price_id").eq("is_addon", true);
for (const a of addons ?? []) {
  if (a.price_monthly == null) { console.log(`  – ${a.name}: no price, skipped`); continue; }
  if (a.stripe_price_id) { console.log(`  ~ ${a.name}: already has price, skipped`); continue; }
  const { productId, priceId } = await ensurePrice({
    name: `JobsAI Enterprise Add-on — ${a.name}`,
    description: `${a.name} add-on`,
    amount: Number(a.price_monthly),
    metadata: { kind: "addon", feature_key: a.feature_key },
  });
  await sb.from("features").update({ stripe_product_id: productId, stripe_price_id: priceId }).eq("feature_key", a.feature_key);
}

// ── Founding Customer coupon: 50% off forever, first 20 ──────────────────────
console.log("\nFounding Customer coupon");
const COUPON_ID = "founding-customer-50";
try {
  const existing = await stripe.coupons.retrieve(COUPON_ID).catch(() => null);
  if (existing) {
    console.log(`  ~ Coupon already exists → ${COUPON_ID}`);
  } else {
    const c = await stripe.coupons.create({
      id: COUPON_ID,
      name: "Founding Customer Program",
      percent_off: 50,
      duration: "forever",
      max_redemptions: 20,
    });
    console.log(`  ✓ Created 50%-off-forever coupon (max 20) → ${c.id}`);
  }
} catch (e) { console.error("  coupon error:", e.message); }

console.log("\n✅ Done. Next: create a Stripe webhook endpoint pointing at");
console.log("   https://app.jobsai.work/api/enterprise/stripe/webhook");
console.log("   (events: customer.subscription.*, checkout.session.completed)");
console.log("   then set STRIPE_ENTERPRISE_WEBHOOK_SECRET on the jobsai-enterprise project.\n");
