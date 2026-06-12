import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getMyMembership } from "@/lib/enterprise";
import { getOrgEntitlements } from "@/lib/enterprise-entitlements";

// What the signed-in member's org plan unlocks. The frontend uses this to hide
// menu items / features the plan doesn't include. (UI hint only — APIs are also
// guarded server-side via requireFeature.)
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await getMyMembership(userId);
  if (!member) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const entitlements = await getOrgEntitlements(member.org_id);
  return NextResponse.json({ data: entitlements });
}
