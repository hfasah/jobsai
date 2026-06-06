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
  for (const f of ["label", "direction", "account_id", "feed_url", "enabled"]) if (body[f] !== undefined) update[f] = body[f];
  // Only overwrite secrets if a new non-empty value is provided
  if (body.api_key) update.api_key = body.api_key;
  if (body.api_secret) update.api_secret = body.api_secret;

  const { data, error } = await supabaseAdmin
    .from("enterprise_board_credentials").update(update).eq("id", id).eq("org_id", org.id)
    .select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: { ...data, api_key: data.api_key ? "set" : null, api_secret: data.api_secret ? "set" : null } });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;
  await supabaseAdmin.from("enterprise_board_credentials").delete().eq("id", id).eq("org_id", org.id);
  return NextResponse.json({ ok: true });
}
