import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY } from "@/lib/campaigns";
import { diagnoseCampaign } from "@/lib/outreach/diagnose";

type Ctx = { params: Promise<{ id: string }> };

// GET — campaign health score + critical errors, warnings, and recommendations.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { data: campaign } = await supabaseAdmin
    .from("enterprise_campaigns").select("id").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  const result = await diagnoseCampaign(org.id, id);
  return NextResponse.json({ data: result });
}
