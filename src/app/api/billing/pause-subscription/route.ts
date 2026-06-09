import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getUserBilling } from "@/lib/billing";

// POST /api/billing/pause-subscription — pause collection for 30 days
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const billing = await getUserBilling(userId);
  if (!billing.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription." }, { status: 409 });
  }

  try {
    const stripe = getStripe();
    const resumesAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    await stripe.subscriptions.update(billing.stripe_subscription_id, {
      pause_collection: { behavior: "void", resumes_at: resumesAt },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to pause subscription.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
