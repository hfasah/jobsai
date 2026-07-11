// Shared guard for the AI SDR campaign routes: AI SDR feature + manage
// permission + the campaign belongs to the caller's org. SERVER-ONLY.
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";

type GuardResult =
  | { error: NextResponse; userId?: undefined; org?: undefined }
  | { error?: undefined; userId: string; org: { id: string; name: string } };

export async function guardCampaign(id: string): Promise<GuardResult> {
  const { userId } = await auth();
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const gate = await requireFeature(userId, "ai_sdr");
  if (gate) return { error: gate };
  const denied = await requirePermission(userId, "can_manage_ai_sdr");
  if (denied) return { error: denied };
  const org = await getMyOrg(userId);
  if (!org) return { error: NextResponse.json({ error: "No organization." }, { status: 404 }) };
  const { data: campaign } = await supabaseAdmin
    .from("enterprise_campaigns")
    .select("id")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!campaign) return { error: NextResponse.json({ error: "Campaign not found." }, { status: 404 }) };
  return { userId, org: { id: org.id, name: org.name } };
}
