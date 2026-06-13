import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requirePermission } from "@/lib/enterprise-permissions";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { audit } from "@/lib/enterprise-audit";
import { exchangeToken } from "@/lib/merge";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;
  const gated = await requireFeature(userId, "ats_integration");
  if (gated) return gated;

  const org = await getMyOrg(userId!);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { public_token } = await req.json().catch(() => ({}));
  if (!public_token) return NextResponse.json({ error: "public_token required." }, { status: 400 });

  let account;
  try {
    account = await exchangeToken(public_token);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Token exchange failed." }, { status: 502 });
  }

  const { error } = await supabaseAdmin
    .from("enterprise_ats_connections")
    .upsert(
      {
        org_id: org.id,
        provider: account.integration?.slug ?? null,
        integration_name: account.integration?.name ?? null,
        account_token: account.account_token,
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
    metadata: { provider: account.integration?.slug, integration: account.integration?.name },
  });

  return NextResponse.json({ ok: true, integration_name: account.integration?.name ?? null });
}
