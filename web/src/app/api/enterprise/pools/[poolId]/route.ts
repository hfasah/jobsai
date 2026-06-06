import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

type Ctx = { params: Promise<{ poolId: string }> };

// PUT — edit a pool (name, criteria, additional_context)
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { poolId } = await params;
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const f of ["name", "description", "criteria", "additional_context", "color"]) {
    if (body[f] !== undefined) update[f] = body[f];
  }

  const { data, error } = await supabaseAdmin
    .from("enterprise_pools").update(update).eq("id", poolId).eq("org_id", org.id)
    .select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE — remove a custom pool (auto pools are protected). Members fall back to inbox.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { poolId } = await params;

  const { data: pool } = await supabaseAdmin.from("enterprise_pools").select("type").eq("id", poolId).eq("org_id", org.id).maybeSingle();
  if (!pool) return NextResponse.json({ error: "Pool not found." }, { status: 404 });
  if (pool.type !== "custom") return NextResponse.json({ error: "Auto pools cannot be deleted." }, { status: 400 });

  await supabaseAdmin.from("enterprise_pools").delete().eq("id", poolId).eq("org_id", org.id);
  return NextResponse.json({ ok: true });
}
