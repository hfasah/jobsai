import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requirePermission } from "@/lib/enterprise-permissions";
import { audit } from "@/lib/enterprise-audit";
import { deleteAccount } from "@/lib/merge";

export async function POST() {
  const { userId } = await auth();
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;

  const org = await getMyOrg(userId!);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("enterprise_ats_connections")
    .select("account_token")
    .eq("org_id", org.id)
    .eq("status", "active")
    .maybeSingle();

  if (data?.account_token) await deleteAccount(data.account_token);

  await supabaseAdmin
    .from("enterprise_ats_connections")
    .update({ status: "disconnected", account_token: "" })
    .eq("org_id", org.id);

  await audit({
    org_id: org.id,
    user_id: userId!,
    action: "ats.disconnected",
    resource_type: "ats_connection",
    resource_id: org.id,
  });

  return NextResponse.json({ ok: true });
}
