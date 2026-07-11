import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";

async function guard(): Promise<{ error: NextResponse } | { userId: string; orgId: string }> {
  const { userId } = await auth();
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return { error: gate };
  const denied = await requirePermission(userId, "can_manage_sourcing");
  if (denied) return { error: denied };
  const org = await getMyOrg(userId);
  if (!org) return { error: NextResponse.json({ error: "No organization." }, { status: 404 }) };
  return { userId, orgId: org.id };
}

// PATCH — { enabled?, api_key? (empty string clears), settings? }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.api_key === "string") patch.api_key = body.api_key.trim() || null;
  if (body.settings && typeof body.settings === "object") patch.settings = body.settings;

  const { data } = await supabaseAdmin
    .from("sourcing_providers")
    .update(patch)
    .eq("id", id)
    .eq("org_id", g.orgId)
    .select("id, provider_key, enabled")
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Provider not found." }, { status: 404 });

  after(() => {
    audit({
      org_id: g.orgId,
      user_id: g.userId,
      action: "sourcing.provider_updated",
      resource_type: "sourcing_provider",
      resource_id: id,
      metadata: { enabled: body.enabled ?? null, key_changed: typeof body.api_key === "string" },
    });
  });

  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { id } = await ctx.params;

  const { data } = await supabaseAdmin
    .from("sourcing_providers")
    .delete()
    .eq("id", id)
    .eq("org_id", g.orgId)
    .select("id, provider_key")
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "Provider not found." }, { status: 404 });

  after(() => {
    audit({
      org_id: g.orgId,
      user_id: g.userId,
      action: "sourcing.provider_updated",
      resource_type: "sourcing_provider",
      resource_id: id,
      metadata: { deleted: true, provider_key: (data as { provider_key: string }).provider_key },
    });
  });

  return NextResponse.json({ data: { deleted: true } });
}
