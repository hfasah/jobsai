import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getMyMembership } from "@/lib/enterprise";
import { getOnboardingStatus } from "@/lib/enterprise-onboarding";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await getMyMembership(userId);
  if (!member) return NextResponse.json({ data: null });
  try {
    return NextResponse.json({ data: await getOnboardingStatus(member.org_id) });
  } catch {
    return NextResponse.json({ data: null });
  }
}
