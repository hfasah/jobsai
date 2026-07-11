import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { getMyOrg } from "@/lib/enterprise";
import { preflightCampaign } from "@/lib/outreach/preflight";

// POST { campaign_id } — launch preflight checks. Advisory in O1 (the UI
// renders pass/warn/fail); O2 hard-gates campaign activation on ok.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "outreach_campaigns");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.campaign_id !== "string" || !body.campaign_id) {
    return NextResponse.json({ error: "campaign_id is required." }, { status: 400 });
  }

  const result = await preflightCampaign(org.id, body.campaign_id);
  return NextResponse.json({ data: result });
}
