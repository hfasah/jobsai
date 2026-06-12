import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyMembership } from "@/lib/enterprise";
import { ROLE_PERMISSIONS, type Permission } from "@/lib/enterprise-rbac";
import type { MemberRole } from "@/types/enterprise";

// Resolve whether a role is granted a permission, honoring per-org overrides in
// enterprise_role_permissions and falling back to the default ROLE_PERMISSIONS
// matrix when no override row exists.
export async function getEffectivePermission(
  orgId: string,
  role: MemberRole,
  permission: Permission,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("enterprise_role_permissions")
    .select(permission)
    .eq("org_id", orgId)
    .eq("role", role)
    .maybeSingle();
  const override = data as Record<string, unknown> | null;
  if (override && typeof override[permission] === "boolean") {
    return override[permission] as boolean;
  }
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

// Route guard. Returns a 401/403 NextResponse to return early, or null when the
// caller is a member whose role grants `permission`. Usage:
//   const denied = await requirePermission(userId, "can_send_offers");
//   if (denied) return denied;
export async function requirePermission(
  userId: string | null,
  permission: Permission,
): Promise<NextResponse | null> {
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const member = await getMyMembership(userId);
  if (!member) {
    return NextResponse.json({ error: "Not an enterprise member." }, { status: 403 });
  }
  const allowed = await getEffectivePermission(member.org_id, member.role as MemberRole, permission);
  if (!allowed) {
    return NextResponse.json(
      { error: "You don't have permission to perform this action." },
      { status: 403 },
    );
  }
  return null;
}
