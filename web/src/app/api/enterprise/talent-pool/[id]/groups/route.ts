import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

type Ctx = { params: Promise<{ id: string }> };

// Manage which named pools a talent-pool candidate belongs to (many-to-many).
// id = enterprise_talent_pool.id

async function ownsMember(orgId: string, id: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("enterprise_talent_pool").select("id").eq("id", id).eq("org_id", orgId).maybeSingle();
  return !!data;
}

// POST { group_id } — add the candidate to a pool.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;
  const { group_id } = await req.json().catch(() => ({}));
  if (!group_id) return NextResponse.json({ error: "group_id required." }, { status: 400 });
  if (!(await ownsMember(org.id, id))) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Check-then-insert (no ON CONFLICT, so it doesn't depend on a unique
  // constraint being present) — already a member is a no-op.
  const { data: existing } = await supabaseAdmin
    .from("enterprise_talent_pool_memberships")
    .select("id").eq("talent_pool_id", id).eq("group_id", group_id).maybeSingle();
  if (!existing) {
    const { error } = await supabaseAdmin
      .from("enterprise_talent_pool_memberships")
      .insert({ org_id: org.id, talent_pool_id: id, group_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// DELETE { group_id } — remove the candidate from a pool.
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;
  const { group_id } = await req.json().catch(() => ({}));
  if (!group_id) return NextResponse.json({ error: "group_id required." }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("enterprise_talent_pool_memberships")
    .delete().eq("org_id", org.id).eq("talent_pool_id", id).eq("group_id", group_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
