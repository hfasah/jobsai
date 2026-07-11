#!/usr/bin/env node

import Stripe from "stripe";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "../.env.local");

// Load .env.local
const envContent = fs.readFileSync(envPath, "utf-8");
const apiKey = envContent
  .split("\n")
  .find((line) => line.startsWith("STRIPE_SECRET_KEY="))
  ?.split("=")[1];

if (!apiKey) {
  console.error("❌ STRIPE_SECRET_KEY not found in .env.local");
  process.exit(1);
}

const stripe = new Stripe(apiKey);

const plans = [
  { id: "pro", name: "Pro", monthlyPrice: 2900, yearlyPrice: 31900 },
  {
    id: "premium",
    name: "Premium",
    monthlyPrice: 7900,
    yearlyPrice: 63900,
  },
  {
    id: "accelerator",
    name: "Career Accelerator",
    monthlyPrice: 19900,
    yearlyPrice: 159900,
  },
];

const tokenPacks = [
  { id: "pack_small", name: "5K Tokens", tokens: 5000, price: 1000 },
  { id: "pack_mid", name: "20K Tokens", tokens: 20000, price: 3000 },
  { id: "pack_large", name: "60K Tokens", tokens: 60000, price: 6900 },
];

async function createProduct(name, metadata = {}) {
  try {
    const product = await stripe.products.create({
      name,
      metadata,
    });
    return product;
  } catch (err) {
    console.error(`Error creating product ${name}:`, err.message);
    throw err;
  }
}

async function createPrice(productId, amount, interval, metadata = {}) {
  try {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: amount,
      currency: "usd",
      recurring: { interval, interval_count: 1 },
      metadata,
    });
    return price;
  } catch (err) {
    console.error(`Error creating price for ${productId}:`, err.message);
    throw err;
  }
}

async function createOneTimePrice(productId, amount, metadata = {}) {
  try {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: amount,
      currency: "usd",
      metadata,
    });
    return price;
  } catch (err) {
    console.error(`Error creating one-time price for ${productId}:`, err.message);
    throw err;
  }
}

async function main() {
  console.log("🚀 Setting up Stripe products and prices...\n");

  const results = {};

  // Create subscription plans
  for (const plan of plans) {
    console.log(`Creating ${plan.name}...`);
    const product = await createProduct(plan.name, { plan: plan.id });

    const monthlyPrice = await createPrice(
      product.id,
      plan.monthlyPrice,
      "month",
      { interval: "monthly" }
    );
    const yearlyPrice = await createPrice(
      product.id,
      plan.yearlyPrice,
      "year",
      { interval: "yearly" }
    );

    results[`STRIPE_${plan.id.toUpperCase()}_PRICE_ID`] = monthlyPrice.id;
    results[`STRIPE_${plan.id.toUpperCase()}_YEARLY_PRICE_ID`] =
      yearlyPrice.id;

    console.log(
      `  ✓ Monthly: ${monthlyPrice.id} ($${(plan.monthlyPrice / 100).toFixed(2)})`
    );
    console.log(
      `  ✓ Yearly: ${yearlyPrice.id} ($${(plan.yearlyPrice / 100).toFixed(2)})`
    );
  }

  console.log();

  // Create token pack products
  for (const pack of tokenPacks) {
    console.log(`Creating ${pack.name}...`);
    const product = await createProduct(pack.name, {
      pack: pack.id,
      tokens: String(pack.tokens),
    });

    const price = await createOneTimePrice(product.id, pack.price, {
      tokens: String(pack.tokens),
    });

    results[`STRIPE_${pack.id.toUpperCase()}_PRICE_ID`] = price.id;
    console.log(
      `  ✓ ${price.id} ($${(pack.price / 100).toFixed(2)}) - ${pack.tokens.toLocaleString()} tokens`
    );
  }

  console.log("\n✅ All products and prices created!\n");
  console.log("📋 Add these to your .env.local and Vercel:\n");

  // Output in .env format
  for (const [key, value] of Object.entries(results)) {
    console.log(`${key}=${value}`);
  }

  console.log("\n💡 Steps:");
  console.log("1. Copy the above and add to .env.local");
  console.log("2. Update Vercel environment variables with these values");
  console.log("3. Redeploy");
}

main().catch((err) => {
  console.error("❌ Setup failed:", err.message);
  process.exit(1);
});
