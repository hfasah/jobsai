import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getMyMembership } from "@/lib/enterprise";
import { getOrgNudges } from "@/lib/enterprise-nudges";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const member = await getMyMembership(userId);
  if (!member) return NextResponse.json({ data: [] });
  try {
    const nudges = await getOrgNudges(member.org_id);
    return NextResponse.json({ data: nudges });
  } catch {
    return NextResponse.json({ data: [] });
  }
}
