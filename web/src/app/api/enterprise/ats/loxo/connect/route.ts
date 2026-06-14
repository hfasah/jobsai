import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requirePermission } from "@/lib/enterprise-permissions";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { audit } from "@/lib/enterprise-audit";
import { loxoTest } from "@/lib/loxo";

// POST — connect Loxo with the customer's API key + agency slug (validated live).
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;
  const gated = await requireFeature(userId, "ats_integration");
  if (gated) return gated;

  const org = await getMyOrg(userId!);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { agency_slug, api_key } = (await req.json().catch(() => ({}))) as { agency_slug?: string; api_key?: string };
  const agency = agency_slug?.trim();
  const key = api_key?.trim();
  if (!agency || !key) {
    return NextResponse.json({ error: "Agency slug and API key are required." }, { status: 400 });
  }

  // Validate the credentials before saving.
  try {
    await loxoTest(agency, key);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? `Couldn't reach Loxo with those credentials. ${e.message}` : "Connection failed." },
      { status: 502 },
    );
  }

  const { error } = await supabaseAdmin
    .from("enterprise_ats_connections")
    .upsert(
      {
        org_id: org.id,
        provider: "loxo",
        integration_name: "Loxo",
        account_token: key,
        agency_slug: agency,
        status: "active",
      },
      { onConflict: "org_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await audit({
    org_id: org.id,
    user_id: userId!,
    action: "ats.connected",
    resource_type: "ats_connection",
    resource_id: org.id,
    metadata: { provider: "loxo", agency_slug: agency },
  });

  return NextResponse.json({ ok: true, integration_name: "Loxo" });
}
