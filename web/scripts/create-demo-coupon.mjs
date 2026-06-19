/**
 * Creates the demo access coupon + promotion code in Stripe:
 *   - Coupon: 100% off, repeating for 12 months (a full year free).
 *   - Promotion code: DEMOYEARLY (capped redemptions so it can't be farmed).
 *
 * Apply it at the enterprise checkout (which already allows promotion codes):
 * pick the highest self-serve plan (Business), enter DEMOYEARLY → free for 1 year.
 *
 * Usage:  cd web && node scripts/create-demo-coupon.mjs
 *         (reads STRIPE_SECRET_KEY from web/.env.local)
 * Idempotent: reuses a fixed coupon id and skips the code if it already exists.
 */
import Stripe from "stripe";
import dotenv from "dotenv";
// An explicitly-exported STRIPE_SECRET_KEY (e.g. pulled from Vercel) wins over
// whatever is in .env.local.
const preset = process.env.STRIPE_SECRET_KEY;
dotenv.config({ path: ".env.local" });

const key = preset || process.env.STRIPE_SECRET_KEY;
if (!key) { console.error("Set STRIPE_SECRET_KEY in .env.local"); process.exit(1); }
console.log(key.startsWith("sk_live_") ? "🔴 LIVE mode" : "🧪 TEST mode");

const stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" });

const COUPON_ID = "demo-yearly-100";
const CODE = "DEMOYEARLY";
const MAX_REDEMPTIONS = 25; // cap exposure; adjust/deactivate anytime in the dashboard

// 1. Coupon (fixed id → idempotent).
let coupon;
try {
  coupon = await stripe.coupons.retrieve(COUPON_ID);
  console.log(`✓ Coupon exists: ${coupon.id} (${coupon.percent_off}% off, ${coupon.duration} ${coupon.duration_in_months ?? ""}mo)`);
} catch {
  coupon = await stripe.coupons.create({
    id: COUPON_ID,
    name: "Demo — 1 year free",
    percent_off: 100,
    duration: "repeating",
    duration_in_months: 12,
  });
  console.log(`＋ Created coupon: ${coupon.id} (100% off for 12 months)`);
}

// 2. Promotion code DEMOYEARLY (the customer-facing code).
const existing = await stripe.promotionCodes.list({ code: CODE, limit: 1 });
if (existing.data.length) {
  const pc = existing.data[0];
  console.log(`✓ Promotion code already exists: ${pc.code} (active: ${pc.active}, used ${pc.times_redeemed}/${pc.max_redemptions ?? "∞"})`);
} else {
  const pc = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: CODE,
    max_redemptions: MAX_REDEMPTIONS,
    active: true,
  });
  console.log(`＋ Created promotion code: ${pc.code} → coupon ${coupon.id} (max ${MAX_REDEMPTIONS} redemptions)`);
}

console.log("\nDone. At enterprise checkout, choose the Business plan and enter DEMOYEARLY.");
