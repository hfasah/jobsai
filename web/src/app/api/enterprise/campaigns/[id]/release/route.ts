import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { CAMPAIGN_FEATURE_KEY } from "@/lib/campaigns";

type Ctx = { params: Promise<{ id: string }> };

// POST — release the rest of a pilot: schedule every held enrollment (active,
// next_send_at cleared) so the remainder of the campaign goes out.
export async function POST(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_send_emails");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { data: campaign } = await supabaseAdmin
    .from("enterprise_campaigns")
    .select("id, status, pilot_released")
    .eq("id", id).eq("org_id", org.id).maybeSingle();
  const c = campaign as { status: string; pilot_released: boolean } | null;
  if (!c) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  if (c.status !== "active") return NextResponse.json({ error: "The campaign must be active to release the rest." }, { status: 400 });
  if (c.pilot_released) return NextResponse.json({ error: "The rest has already been released." }, { status: 400 });

  // Held pilot enrollments are active with no next_send_at — schedule them now.
  const { data: released } = await supabaseAdmin
    .from("enterprise_campaign_enrollments")
    .update({ next_send_at: new Date().toISOString() })
    .eq("campaign_id", id)
    .eq("org_id", org.id)
    .eq("status", "active")
    .is("next_send_at", null)
    .select("id");

  await supabaseAdmin
    .from("enterprise_campaigns")
    .update({ pilot_released: true, updated_at: new Date().toISOString() })
    .eq("id", id).eq("org_id", org.id);

  return NextResponse.json({ data: { released: (released ?? []).length } });
}
