import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { CAMPAIGN_PRESETS } from "@/lib/campaigns";

// GET — preset starter sequences a recruiter can clone, then customize.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ data: CAMPAIGN_PRESETS });
}
