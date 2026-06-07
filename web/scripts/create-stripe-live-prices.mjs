/**
 * Creates all JobsAI products + prices in Stripe LIVE mode and prints a
 * ready-to-paste block of Vercel env vars at the end.
 *
 * Usage:  STRIPE_SECRET_KEY=sk_live_... node scripts/create-stripe-live-prices.mjs
 * Test first with sk_test_... and TEST env vars before going live.
 *
 * NOTE: each run CREATES NEW products/prices (Stripe prices are immutable).
 *   • Pricing that changed: Pro ($39 / $372) + token packs (3k/$10, 10k/$30,
 *     25k/$69). If Premium/Accelerator already exist unchanged, comment out
 *     those two sections so you don't create duplicates.
 *   • After switching env to the new IDs + redeploying, ARCHIVE the old prices
 *     in Stripe (old Pro $29/$276 and old 5k/20k/60k packs) so nothing bills the
 *     old amounts. Archiving a price doesn't affect existing subscriptions.
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

// Prices are created in USD. Currency at checkout is handled by Stripe, not the
// app: enable "Adaptive Pricing" in the Stripe Dashboard (Settings → Payments)
// so customers see and pay in their local currency automatically.
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
ids.STRIPE_PRO_PRICE_ID          = await price(proId,   39,   "usd", "month");
ids.STRIPE_PRO_YEARLY_PRICE_ID   = await price(proId,  372,   "usd", "year");   // $31/mo
console.log(`  ✓ Monthly $39   → ${ids.STRIPE_PRO_PRICE_ID}`);
console.log(`  ✓ Yearly  $372  → ${ids.STRIPE_PRO_YEARLY_PRICE_ID}`);

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

// ── Token packs (one-time, premium per-token vs subscriptions) ────────────────
console.log("Token Packs");
const packSmallId = await product("JobsAI Token Pack 3k",  "3,000 tokens — résumé tailoring, cover letters, interview prep");
const packMidId   = await product("JobsAI Token Pack 10k", "10,000 tokens — résumé tailoring, cover letters, interview prep");
const packLargeId = await product("JobsAI Token Pack 25k", "25,000 tokens — résumé tailoring, cover letters, interview prep");
ids.STRIPE_PACK_SMALL_PRICE_ID = await price(packSmallId,  10, "usd");
ids.STRIPE_PACK_MID_PRICE_ID   = await price(packMidId,    30, "usd");
ids.STRIPE_PACK_LARGE_PRICE_ID = await price(packLargeId,  69, "usd");
console.log(`  ✓ 3k  $10  → ${ids.STRIPE_PACK_SMALL_PRICE_ID}`);
console.log(`  ✓ 10k $30  → ${ids.STRIPE_PACK_MID_PRICE_ID}`);
console.log(`  ✓ 25k $69  → ${ids.STRIPE_PACK_LARGE_PRICE_ID}`);

// ── Output ───────────────────────────────────────────────────────────────────
console.log("\n✅  Done! Paste these into Vercel → Settings → Environment Variables:\n");
console.log("─".repeat(60));
for (const [k, v] of Object.entries(ids)) {
  console.log(`${k}=${v}`);
}
console.log("─".repeat(60));
console.log("\nRemember to Redeploy on Vercel after saving.\n");
