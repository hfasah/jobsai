import { auth } from "@clerk/nextjs/server";
import { requirePermission } from "@/lib/enterprise-permissions";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  return NextResponse.json({ data: { api_key: (org as { api_key?: string }).api_key ?? null } });
}

// POST — generate / rotate the org API key (owners only)
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;
  const membership = await getMyMembership(userId);
  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only the owner can manage the API key." }, { status: 403 });
  }
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const key = `jbai_ent_${randomBytes(24).toString("hex")}`;
  const { error } = await supabaseAdmin
    .from("enterprise_orgs")
    .update({ api_key: key, api_key_created_at: new Date().toISOString() })
    .eq("id", org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await audit({ org_id: org.id, user_id: userId, action: "integration.connected", metadata: { api_key_rotated: true } });
  return NextResponse.json({ data: { api_key: key } });
}
