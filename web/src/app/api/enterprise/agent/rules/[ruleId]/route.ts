import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

type Ctx = { params: Promise<{ ruleId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { ruleId } = await params;

  const body = await req.json().catch(() => ({}));
  const allowed = ["name", "description", "conditions", "action", "action_config", "active", "job_id"];
  const update: Record<string, unknown> = {};
  for (const k of allowed) if (body[k] !== undefined) update[k] = body[k];

  const { data, error } = await supabaseAdmin
    .from("enterprise_pipeline_rules")
    .update(update)
    .eq("id", ruleId)
    .eq("org_id", org.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { ruleId } = await params;

  await supabaseAdmin
    .from("enterprise_pipeline_rules")
    .delete()
    .eq("id", ruleId)
    .eq("org_id", org.id);

  return NextResponse.json({ ok: true });
}
