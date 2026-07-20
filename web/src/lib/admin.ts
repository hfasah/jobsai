import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// ─── Admin RBAC ───────────────────────────────────────────────────────────────
// Two sources of admin identity:
//   1. ADMIN_USER_IDS env — super admins, always full access (bootstrap; no DB
//      row needed, can never be locked out by a bad staff row).
//   2. admin_staff table (migration 177) — support/analyst/sales staff with a
//      role granting default permissions plus per-person boolean overrides.
// Every /api/admin route calls requireAdminPerm(<perm>) — the server-side
// truth. Nav/page hiding is cosmetic on top.

import { ALL_PERMS, ROLE_GRANTS, ROLE_GRANT_CAP, type AdminPerm, type AdminRole } from "@/lib/admin-perms";

export type { AdminPerm, AdminRole };

export interface AdminContext {
  userId: string;
  role: AdminRole;
  perms: Set<AdminPerm>;
  grantCapDaily: number | null; // null = unlimited
  can: (perm: AdminPerm) => boolean;
}

function buildContext(userId: string, role: AdminRole, overrides: Record<string, unknown>, capOverride: number | null): AdminContext {
  const perms = new Set<AdminPerm>(ROLE_GRANTS[role]);
  for (const p of ALL_PERMS) {
    const v = overrides?.[p];
    if (v === true) perms.add(p);
    else if (v === false) perms.delete(p);
  }
  // Super admins are never capped — even a stray grant_cap_daily on their row
  // is ignored.
  const grantCapDaily = role === "super_admin" ? null : capOverride ?? ROLE_GRANT_CAP[role] ?? null;
  return { userId, role, perms, grantCapDaily, can: (perm) => perms.has(perm) };
}

export async function getAdminContext(): Promise<AdminContext | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (adminIds.includes(userId)) {
    return buildContext(userId, "super_admin", {}, null);
  }

  const { data: staff, error } = await supabaseAdmin
    .from("admin_staff")
    .select("role, overrides, grant_cap_daily, active")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    console.error("[admin-rbac] admin_staff lookup failed:", error.message);
    return null;
  }
  if (!staff?.active) return null;
  return buildContext(userId, staff.role as AdminRole, (staff.overrides ?? {}) as Record<string, unknown>, staff.grant_cap_daily ?? null);
}

// Route guard: returns the context when the caller holds the permission.
export async function requireAdminPerm(perm: AdminPerm): Promise<AdminContext | null> {
  const ctx = await getAdminContext();
  if (!ctx || !ctx.can(perm)) return null;
  return ctx;
}

// Legacy guard — now means "any active admin/staff member" for routes that
// only need portal membership. Prefer requireAdminPerm.
export async function requireAdmin(): Promise<{ ok: true; userId: string } | { ok: false }> {
  const ctx = await getAdminContext();
  return ctx ? { ok: true, userId: ctx.userId } : { ok: false };
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export async function adminAudit(
  ctx: AdminContext,
  action: string,
  target?: { type?: string; id?: string },
  meta: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await supabaseAdmin.from("admin_audit_log").insert({
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action,
    target_type: target?.type ?? null,
    target_id: target?.id ?? null,
    meta,
  });
  if (error) console.error("[admin-rbac] audit insert failed:", error.message);
}

// How many credits this actor may still grant today (Infinity when uncapped).
export async function grantAllowanceToday(ctx: AdminContext): Promise<number> {
  if (ctx.grantCapDaily == null) return Number.POSITIVE_INFINITY;
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabaseAdmin
    .from("admin_audit_log")
    .select("meta")
    .eq("actor_id", ctx.userId)
    .eq("action", "users.grant_credits")
    .gte("created_at", dayStart.toISOString());
  if (error) {
    console.error("[admin-rbac] grant allowance query failed:", error.message);
    return 0; // fail closed — a broken meter must not mean unlimited grants
  }
  const spent = (data ?? []).reduce((sum, row) => sum + (Number((row.meta as { amount?: number })?.amount) || 0), 0);
  return Math.max(0, ctx.grantCapDaily - spent);
}
