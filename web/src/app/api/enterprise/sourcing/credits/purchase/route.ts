import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { getPack } from "@/lib/sourcing/packs";

// POST /api/enterprise/sourcing/credits/purchase { pack: "pack_500" }
// One-time Stripe Checkout for a credit top-up. The enterprise webhook grants
// the credits on checkout.session.completed (idempotent per session id).
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_manage_sourcing");
  if (denied) return denied;
  const org = (await getMyOrg(userId)) as { id: string; name: string; stripe_customer_id?: string | null } | null;
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const pack = getPack(typeof body.pack === "string" ? body.pack : "");
  if (!pack) return NextResponse.json({ error: "Unknown credit pack." }, { status: 400 });

  const stripe = getStripe();

  // Reuse or create the org's Stripe customer (same pattern as plan checkout).
  let customerId = org.stripe_customer_id ?? null;
  if (!customerId) {
    const client = await clerkClient();
    const user = await client.users.getUser(userId).catch(() => null);
    const customer = await stripe.customers.create({
      email: user?.emailAddresses?.[0]?.emailAddress ?? undefined,
      name: org.name,
      metadata: { org_id: org.id },
    });
    customerId = customer.id;
    await supabaseAdmin.from("enterprise_orgs").update({ stripe_customer_id: customerId }).eq("id", org.id);
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work").replace(/\/$/, "");
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pack.amount_cents,
          product_data: {
            name: `JobsAI Sourcing Credits — ${pack.label}`,
            description: "Credits for external talent search, contact reveals and enrichment.",
          },
        },
      },
    ],
    success_url: `${base}/enterprise/sourcing/credits?purchased=1`,
    cancel_url: `${base}/enterprise/sourcing/credits`,
    metadata: { org_id: org.id, sourcing_credits: String(pack.credits), pack: pack.key },
  });

  return NextResponse.json({ data: { url: session.url } });
}
