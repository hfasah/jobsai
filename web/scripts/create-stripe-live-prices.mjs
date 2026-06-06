/**
 * Creates all JobsAI products + prices in Stripe LIVE mode.
 * Usage:  STRIPE_SECRET_KEY=sk_live_... node scripts/create-stripe-live-prices.mjs
 *
 * Outputs a ready-to-paste block of Vercel env vars at the end.
 */

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error("Set STRIPE_SECRET_KEY=sk_live_... before running."); process.exit(1); }
if (!key.startsWith("sk_live_")) { console.warn("⚠️  Key looks like test mode. Did you mean to use sk_live_...?"); }

const stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });

async function product(name, description) {
  const p = await stripe.products.create({ name, description });
  console.log(`  ✓ Product: ${name} (${p.id})`);
  return p.id;
}

async function price(productId, amount, currency, interval, intervalCount) {
  const recurring = interval ? { interval, interval_count: intervalCount ?? 1 } : undefined;
  const p = await stripe.prices.create({
    product: productId,
    unit_amount: Math.round(amount * 100),
    currency,
    ...(recurring ? { recurring } : {}),
  });
  return p.id;
}

console.log("\n🚀 Creating JobsAI Stripe products + prices (live mode)...\n");

const ids = {};

// ── Pro ─────────────────────────────────────────────────────────────────────
console.log("Pro");
const proId = await product("JobsAI Pro", "Auto-apply, unlimited jobs, resume tailoring, 90-day guarantee");
ids.STRIPE_PRO_PRICE_ID          = await price(proId,   29,   "usd", "month");
ids.STRIPE_PRO_YEARLY_PRICE_ID   = await price(proId,  276,   "usd", "year");   // $23/mo
console.log(`  ✓ Monthly $29   → ${ids.STRIPE_PRO_PRICE_ID}`);
console.log(`  ✓ Yearly  $276  → ${ids.STRIPE_PRO_YEARLY_PRICE_ID}`);

// ── Premium ──────────────────────────────────────────────────────────────────
console.log("Premium");
const premiumId = await product("JobsAI Premium", "Everything in Pro + AI Voice interviews + 20k tokens/mo");
ids.STRIPE_PREMIUM_PRICE_ID          = await price(premiumId,   79,   "usd", "month");
ids.STRIPE_PREMIUM_YEARLY_PRICE_ID   = await price(premiumId,  756,   "usd", "year");  // $63/mo
console.log(`  ✓ Monthly $79   → ${ids.STRIPE_PREMIUM_PRICE_ID}`);
console.log(`  ✓ Yearly  $756  → ${ids.STRIPE_PREMIUM_YEARLY_PRICE_ID}`);

// ── Career Accelerator ───────────────────────────────────────────────────────
console.log("Career Accelerator");
const accId = await product("JobsAI Career Accelerator", "Everything in Premium + Avatar room + 60k tokens/mo");
ids.STRIPE_ACCELERATOR_PRICE_ID          = await price(accId,   199,   "usd", "month");
ids.STRIPE_ACCELERATOR_YEARLY_PRICE_ID   = await price(accId,  1908,   "usd", "year");  // $159/mo
console.log(`  ✓ Monthly $199  → ${ids.STRIPE_ACCELERATOR_PRICE_ID}`);
console.log(`  ✓ Yearly  $1908 → ${ids.STRIPE_ACCELERATOR_YEARLY_PRICE_ID}`);

// ── Token packs (one-time) ───────────────────────────────────────────────────
console.log("Token Packs");
const pack5Id  = await product("JobsAI Token Pack 5k",  "5,000 tokens — for voice & avatar interview prep");
const pack20Id = await product("JobsAI Token Pack 20k", "20,000 tokens — for voice & avatar interview prep");
const pack60Id = await product("JobsAI Token Pack 60k", "60,000 tokens — for voice & avatar interview prep");
ids.STRIPE_PACK_5K_PRICE_ID  = await price(pack5Id,   9,  "usd");
ids.STRIPE_PACK_20K_PRICE_ID = await price(pack20Id,  29, "usd");
ids.STRIPE_PACK_60K_PRICE_ID = await price(pack60Id,  69, "usd");
console.log(`  ✓ 5k  $9   → ${ids.STRIPE_PACK_5K_PRICE_ID}`);
console.log(`  ✓ 20k $29  → ${ids.STRIPE_PACK_20K_PRICE_ID}`);
console.log(`  ✓ 60k $69  → ${ids.STRIPE_PACK_60K_PRICE_ID}`);

// ── Output ───────────────────────────────────────────────────────────────────
console.log("\n✅  Done! Paste these into Vercel → Settings → Environment Variables:\n");
console.log("─".repeat(60));
for (const [k, v] of Object.entries(ids)) {
  console.log(`${k}=${v}`);
}
console.log("─".repeat(60));
console.log("\nRemember to Redeploy on Vercel after saving.\n");
