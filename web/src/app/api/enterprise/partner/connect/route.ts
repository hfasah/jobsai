import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getPartnerByUser } from "@/lib/partner-program";
import { ensureConnectAccount, createOnboardingLink } from "@/lib/partner-connect";

// Starts (or resumes) Stripe Connect Express onboarding for the partner and
// returns a hosted onboarding URL to redirect to.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const partner = await getPartnerByUser(userId);
  if (!partner) return NextResponse.json({ error: "Join the Partner Program first." }, { status: 400 });

  try {
    const accountId = await ensureConnectAccount(partner);
    const url = await createOnboardingLink(accountId, req.nextUrl.origin);
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not start payout onboarding.";
    // Most common cause: Connect isn't enabled on the Stripe account yet.
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
