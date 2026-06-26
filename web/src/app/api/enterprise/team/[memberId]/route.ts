import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";

type Ctx = { params: Promise<{ memberId: string }> };

const VALID_ROLES = ["owner", "admin", "recruiter", "hiring_manager", "interviewer", "department_head", "viewer"];

async function ownerCount(orgId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("enterprise_members")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("role", "owner");
  return count ?? 0;
}

// PUT — change a member's role. Owners and admins can manage roles, but only an
// owner may grant or modify the `owner` role, and the last owner can't be demoted.
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
  if (!VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }

  const { data: target } = await supabaseAdmin
    .from("enterprise_members").select("id, role").eq("id", memberId).eq("org_id", org.id).maybeSingle();
  if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });

  // Only owners can assign or alter the owner role.
  if ((body.role === "owner" || target.role === "owner") && membership.role !== "owner") {
    return NextResponse.json({ error: "Only an owner can assign or change the owner role." }, { status: 403 });
  }
  // Don't strip the workspace's last owner.
  if (target.role === "owner" && body.role !== "owner" && (await ownerCount(org.id)) <= 1) {
    return NextResponse.json({ error: "The workspace must have at least one owner." }, { status: 400 });
  }

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

// DELETE — remove a member. Owners and admins can remove members; admins cannot
// remove an owner, the last owner can't be removed, and you can't remove yourself.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getMyMembership(userId);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Only owners and admins can remove members." }, { status: 403 });
  }
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { memberId } = await params;

  const { data: target } = await supabaseAdmin
    .from("enterprise_members").select("id, role, user_id").eq("id", memberId).eq("org_id", org.id).maybeSingle();
  if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  if (target.user_id === userId) return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });
  if (target.role === "owner" && membership.role !== "owner") {
    return NextResponse.json({ error: "Only an owner can remove another owner." }, { status: 403 });
  }
  if (target.role === "owner" && (await ownerCount(org.id)) <= 1) {
    return NextResponse.json({ error: "The workspace must have at least one owner." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("enterprise_members")
    .delete()
    .eq("id", memberId)
    .eq("org_id", org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit({ org_id: org.id, user_id: userId, action: "member.removed", resource_type: "member", resource_id: memberId });
  return NextResponse.json({ ok: true });
}
