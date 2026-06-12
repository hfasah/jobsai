import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (body.name !== undefined) update.name = body.name;
  if (body.active !== undefined) update.active = body.active;
  if (body.trigger_type !== undefined) update.trigger_type = body.trigger_type;
  if (body.trigger_stage !== undefined) update.trigger_stage = body.trigger_stage;
  if (body.action_type !== undefined) update.action_type = body.action_type;
  if (body.action_config !== undefined) update.action_config = body.action_config;
  if (body.sort_order !== undefined) update.sort_order = body.sort_order;

  const { data, error } = await supabaseAdmin
    .from("enterprise_workflow_rules")
    .update(update)
    .eq("id", id)
    .eq("org_id", org.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  await supabaseAdmin
    .from("enterprise_workflow_rules")
    .delete()
    .eq("id", id)
    .eq("org_id", org.id);

  return NextResponse.json({ ok: true });
}
