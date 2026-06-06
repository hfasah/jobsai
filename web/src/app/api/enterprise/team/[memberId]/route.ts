import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";

type Ctx = { params: Promise<{ memberId: string }> };

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getMyMembership(userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { memberId } = await params;
  const body = await req.json().catch(() => ({}));

  const { data, error } = await supabaseAdmin
    .from("enterprise_members")
    .update({ role: body.role })
    .eq("id", memberId)
    .eq("org_id", org.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit({ org_id: org.id, user_id: userId, action: "member.role_changed", resource_type: "member", resource_id: memberId, metadata: { role: body.role } });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getMyMembership(userId);
  if (!membership || membership.role !== "owner") {
    return NextResponse.json({ error: "Only owners can remove members." }, { status: 403 });
  }
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { memberId } = await params;

  const { error } = await supabaseAdmin
    .from("enterprise_members")
    .delete()
    .eq("id", memberId)
    .eq("org_id", org.id)
    .neq("user_id", userId); // can't remove yourself

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit({ org_id: org.id, user_id: userId, action: "member.removed", resource_type: "member", resource_id: memberId });
  return NextResponse.json({ ok: true });
}
