import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { audit } from "@/lib/enterprise-audit";

async function authed() {
  const { userId } = await auth();
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const gate = await requireFeature(userId, "ai_sdr");
  if (gate) return { error: gate };
  const denied = await requirePermission(userId, "can_manage_ai_sdr");
  if (denied) return { error: denied };
  const org = await getMyOrg(userId);
  if (!org) return { error: NextResponse.json({ error: "No organization." }, { status: 404 }) };
  return { userId, org };
}

// GET — workspace-level AI SDR settings (the kill switch).
export async function GET() {
  const a = await authed();
  if (a.error) return a.error;
  const { data } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("ai_sdr_paused")
    .eq("id", a.org.id)
    .maybeSingle();
  return NextResponse.json({ data: { paused: (data as { ai_sdr_paused?: boolean } | null)?.ai_sdr_paused ?? false } });
}

// PATCH — flip the workspace kill switch: { paused: boolean }
export async function PATCH(req: NextRequest) {
  const a = await authed();
  if (a.error) return a.error;
  const body = await req.json().catch(() => ({}));
  if (typeof body.paused !== "boolean") return NextResponse.json({ error: "paused must be a boolean." }, { status: 400 });

  await supabaseAdmin
    .from("enterprise_orgs")
    .update({ ai_sdr_paused: body.paused })
    .eq("id", a.org.id);
  audit({
    org_id: a.org.id, user_id: a.userId, action: "ai_sdr.workspace_paused",
    resource_type: "workspace", metadata: { paused: body.paused },
  });
  return NextResponse.json({ data: { paused: body.paused } });
}
