import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { ensurePartnerAccount } from "@/lib/partner-program";

// Join the Partner Program: creates a partner_account (with referral code, and
// the founding rate if within the first cohort) for the signed-in user.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const company = (body.company_name as string | undefined)?.trim() || null;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  const account = await ensurePartnerAccount(userId, { company_name: company, email });
  return NextResponse.json({ data: account });
}
