import { auth } from "@clerk/nextjs/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "compliance_gdpr");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const allowed = ["status", "notes", "candidate_name"];
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k];

  if (body.status === "completed" || body.status === "rejected") {
    update.resolved_at = new Date().toISOString();
    update.resolved_by = userId;
  }

  const { data, error } = await supabaseAdmin
    .from("enterprise_compliance_requests")
    .update(update)
    .eq("id", id)
    .eq("org_id", org.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "compliance_gdpr");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  await supabaseAdmin
    .from("enterprise_compliance_requests")
    .delete()
    .eq("id", id)
    .eq("org_id", org.id);

  return NextResponse.json({ ok: true });
}
