import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("enterprise_integrations")
    .select("id,provider,subdomain,enabled,last_sync,created_at")
    .eq("org_id", org.id);

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { provider, api_key, subdomain } = body;
  if (!provider || !api_key) return NextResponse.json({ error: "provider and api_key required." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("enterprise_integrations")
    .upsert({ org_id: org.id, provider, api_key, subdomain: subdomain ?? null, enabled: true }, { onConflict: "org_id,provider" })
    .select("id,provider,subdomain,enabled,last_sync,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit({ org_id: org.id, user_id: userId, action: "integration.connected", resource_type: "integration", resource_id: data.id, metadata: { provider } });
  return NextResponse.json({ data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { provider } = await req.json().catch(() => ({}));
  await supabaseAdmin.from("enterprise_integrations").delete().eq("org_id", org.id).eq("provider", provider);
  await audit({ org_id: org.id, user_id: userId, action: "integration.disconnected", metadata: { provider } });
  return NextResponse.json({ ok: true });
}
