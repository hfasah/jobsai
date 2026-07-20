#!/usr/bin/env node
// Provision the Enterprise Starter plan in Stripe: product + $99/mo and
// $948/yr prices. Idempotent via price lookup_keys. Prints the SQL to paste
// into the Supabase editor (local env has no service-role key).
//
// Run: node scripts/setup-starter-stripe.mjs

import Stripe from "stripe";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envContent = fs.readFileSync(path.resolve(__dirname, "../.env.local"), "utf-8");
const apiKey = envContent.split("\n").find((l) => l.startsWith("STRIPE_SECRET_KEY="))?.split("=")[1]?.trim();
if (!apiKey) { console.error("❌ STRIPE_SECRET_KEY not found in .env.local"); process.exit(1); }

const stripe = new Stripe(apiKey);

const LOOKUP_MONTHLY = "enterprise-starter-monthly";
const LOOKUP_YEARLY = "enterprise-starter-yearly";

async function findByLookup(key) {
  const res = await stripe.prices.list({ lookup_keys: [key], limit: 1 });
  return res.data[0] ?? null;
}

async function main() {
  let monthly = await findByLookup(LOOKUP_MONTHLY);
  let yearly = await findByLookup(LOOKUP_YEARLY);

  if (!monthly || !yearly) {
    const product = monthly?.product ?? yearly?.product ?? (await stripe.products.create({
      name: "JobsAI Enterprise Starter",
      description: "For independent recruiters & boutique agencies — AI Recruiting ATS & CRM, 1 recruiter, 10 active jobs, 2,000 candidates.",
      metadata: { plan_slug: "starter" },
    })).id;

    if (!monthly) {
      monthly = await stripe.prices.create({
        product: typeof product === "string" ? product : product.id,
        unit_amount: 9900, currency: "usd",
        recurring: { interval: "month" },
        lookup_key: LOOKUP_MONTHLY,
        nickname: "Starter monthly $99",
      });
    }
    if (!yearly) {
      yearly = await stripe.prices.create({
        product: typeof product === "string" ? product : product.id,
        unit_amount: 94800, currency: "usd",
        recurring: { interval: "year" },
        lookup_key: LOOKUP_YEARLY,
        nickname: "Starter yearly $948 ($79/mo)",
      });
    }
  }

  console.log("✅ Stripe Starter prices ready:");
  console.log("   monthly:", monthly.id);
  console.log("   yearly: ", yearly.id);
  console.log("\nPaste this into the Supabase SQL editor:\n");
  console.log(`update plans set stripe_price_id = '${monthly.id}', stripe_price_id_yearly = '${yearly.id}' where slug = 'starter';`);
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });
