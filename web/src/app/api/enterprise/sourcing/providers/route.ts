import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";

const VALID_KEYS = ["mock", "pdl"] as const;

function mask(key: string | null): string | null {
  if (!key) return null;
  return key.length <= 6 ? "••••" : `${key.slice(0, 3)}••••${key.slice(-2)}`;
}

// GET — org provider rows (API keys always masked) + platform defaults info.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_manage_sourcing");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("sourcing_providers")
    .select("id, provider_key, enabled, api_key, settings, created_at")
    .eq("org_id", org.id);
  const rows = ((data ?? []) as { id: string; provider_key: string; enabled: boolean; api_key: string | null; settings: unknown; created_at: string }[]).map((r) => ({
    ...r,
    api_key: mask(r.api_key),
    has_own_key: !!r.api_key,
  }));

  return NextResponse.json({
    data: {
      providers: rows,
      platform: {
        pdl_available: !!process.env.PDL_API_KEY,
        mock_forced: process.env.SOURCING_MOCK === "1",
      },
    },
  });
}

// POST — add/enable a provider for the org: { provider_key, api_key?, enabled?, settings? }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_manage_sourcing");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const providerKey = VALID_KEYS.includes(body.provider_key) ? body.provider_key : null;
  if (!providerKey) return NextResponse.json({ error: "Invalid provider_key." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("sourcing_providers")
    .upsert(
      {
        org_id: org.id,
        provider_key: providerKey,
        enabled: body.enabled !== false,
        api_key: typeof body.api_key === "string" && body.api_key.trim() ? body.api_key.trim() : null,
        settings: body.settings && typeof body.settings === "object" ? body.settings : {},
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,provider_key" },
    )
    .select("id, provider_key, enabled")
    .single();
  if (error || !data) return NextResponse.json({ error: "Could not save provider." }, { status: 500 });

  after(() => {
    audit({
      org_id: org.id,
      user_id: userId,
      action: "sourcing.provider_updated",
      resource_type: "sourcing_provider",
      resource_id: (data as { id: string }).id,
      metadata: { provider_key: providerKey, enabled: body.enabled !== false, own_key: !!body.api_key },
    });
  });

  return NextResponse.json({ data });
}
