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

  const update: Record<string, unknown> = {};
  for (const f of ["status", "provider", "reference_id", "notes", "result_summary"]) {
    if (body[f] !== undefined) update[f] = body[f];
  }
  if (body.status && ["clear", "flagged", "failed", "na"].includes(body.status)) {
    update.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabaseAdmin
    .from("enterprise_background_checks").update(update).eq("id", id).eq("org_id", org.id)
    .select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;
  await supabaseAdmin.from("enterprise_background_checks").delete().eq("id", id).eq("org_id", org.id);
  return NextResponse.json({ ok: true });
}
