import { auth } from "@clerk/nextjs/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("data_retention_days,retention_action")
    .eq("id", org.id)
    .maybeSingle();

  // Preview: how many rejected/archived apps would be affected right now
  let affectedCount = 0;
  if (data?.data_retention_days) {
    const cutoff = new Date(Date.now() - (data.data_retention_days as number) * 86_400_000).toISOString();
    const { count } = await supabaseAdmin
      .from("enterprise_applications")
      .select("id", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("stage", "rejected")
      .eq("legal_hold", false)
      .lte("stage_updated_at", cutoff);
    affectedCount = count ?? 0;
  }

  return NextResponse.json({
    data_retention_days: (data?.data_retention_days as number | null) ?? null,
    retention_action: (data?.retention_action as string) ?? "anonymize",
    affected_count: affectedCount,
  });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "retention_policies");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if (body.data_retention_days !== undefined) update.data_retention_days = body.data_retention_days ?? null;
  if (body.retention_action !== undefined) update.retention_action = body.retention_action;

  const { error } = await supabaseAdmin
    .from("enterprise_orgs")
    .update(update)
    .eq("id", org.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void supabaseAdmin.from("enterprise_audit_logs").insert({
    org_id: org.id, user_id: userId,
    action: "compliance.retention_updated",
    resource_type: "org", resource_id: org.id,
    metadata: update,
  });

  return NextResponse.json({ ok: true });
}
