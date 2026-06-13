import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getMyOrg } from "@/lib/enterprise";

// Opens the Stripe Customer Portal so a subscribed org can upgrade/downgrade,
// manage add-ons, update payment, or cancel. Requires an existing customer.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = (await getMyOrg(userId)) as { id: string; stripe_customer_id?: string | null } | null;
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  if (!org.stripe_customer_id) {
    return NextResponse.json({ error: "No subscription yet.", redirect: "/enterprise/plans" }, { status: 400 });
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work").replace(/\/$/, "");
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${base}/enterprise/billing`,
    });
    return NextResponse.json({ url: session.url });
  } catch {
    // Portal not configured in Stripe yet → fall back to the plans page.
    return NextResponse.json(
      { error: "Billing portal not configured.", redirect: "/enterprise/plans" },
      { status: 400 },
    );
  }
}
