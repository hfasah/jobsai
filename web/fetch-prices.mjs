import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function getPrices() {
  const products = await stripe.products.list({ limit: 100 });
  const jobsaiProducts = products.data.filter(p => p.name.startsWith("JobsAI"));
  
  console.log("\n=== STRIPE PRICE IDs ===\n");
  
  for (const product of jobsaiProducts) {
    console.log(`${product.name}:`);
    const prices = await stripe.prices.list({ product: product.id, limit: 10 });
    
    for (const price of prices.data) {
      const interval = price.recurring?.interval || "one-time";
      const amount = (price.unit_amount / 100).toFixed(2);
      console.log(`  ${interval.padEnd(10)} $${amount.padEnd(6)} → ${price.id}`);
    }
    console.log();
  }
}

getPrices().catch(console.error);
