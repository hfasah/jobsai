import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function getAll() {
  const products = await stripe.products.list({ limit: 100 });
  console.log(`\nFound ${products.data.length} products:\n`);
  
  for (const p of products.data) {
    console.log(`${p.name} (${p.id})`);
  }
}

getAll().catch(console.error);
