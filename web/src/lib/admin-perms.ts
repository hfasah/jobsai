// Pure constants shared by server RBAC (lib/admin.ts) and client admin UI.
// KEEP SERVER-FREE: no supabase/clerk imports (client components import this).

export type AdminRole = "super_admin" | "support_agent" | "support_lead" | "analyst" | "sales";

export type AdminPerm =
  | "overview"
  | "analytics"
  | "users.view"
  | "users.grant_credits"
  | "users.money_refund"
  | "users.cancel_sub"
  | "users.suspend"
  | "users.delete"
  | "users.impersonate"
  | "users.plan_override"
  | "support"
  | "sales"
  | "enterprise"
  | "enterprise.manage"
  | "partners"
  | "partners.payout"
  | "blog"
  | "ops"
  | "staff.manage";

export const ALL_PERMS: AdminPerm[] = [
  "overview", "analytics", "users.view", "users.grant_credits", "users.money_refund",
  "users.cancel_sub", "users.suspend", "users.delete", "users.impersonate", "users.plan_override",
  "support", "sales", "enterprise", "enterprise.manage", "partners", "partners.payout",
  "blog", "ops", "staff.manage",
];

export const ROLE_GRANTS: Record<AdminRole, AdminPerm[]> = {
  super_admin: ALL_PERMS,
  support_agent: ["overview", "analytics", "users.view", "users.grant_credits", "users.cancel_sub", "support"],
  support_lead: ["overview", "analytics", "users.view", "users.grant_credits", "users.money_refund", "users.cancel_sub", "users.suspend", "support"],
  analyst: ["overview", "analytics", "users.view"],
  sales: ["sales", "enterprise", "partners"],
};

// Daily credit-grant ceilings by role (admin_staff.grant_cap_daily overrides).
export const ROLE_GRANT_CAP: Partial<Record<AdminRole, number>> = {
  support_agent: 2000,
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  support_agent: "Support Agent",
  support_lead: "Support Lead",
  analyst: "Analyst (read-only)",
  sales: "Sales",
};

export const PERM_LABELS: Record<AdminPerm, string> = {
  "overview": "Overview dashboard",
  "analytics": "Analytics (usage, churn, traffic, auto-apply)",
  "users.view": "View users & diagnosis",
  "users.grant_credits": "Grant credits",
  "users.money_refund": "Money refunds (Stripe)",
  "users.cancel_sub": "Cancel subscriptions",
  "users.suspend": "Suspend accounts",
  "users.delete": "Delete accounts",
  "users.impersonate": "Impersonate (open account)",
  "users.plan_override": "Override plan",
  "support": "Support inbox",
  "sales": "Sales pipeline",
  "enterprise": "Enterprise (orgs, intake, quotes)",
  "enterprise.manage": "Enterprise org management",
  "partners": "Partners",
  "partners.payout": "Partner payouts",
  "blog": "Blog",
  "ops": "Ops tools (reclaim, backfills)",
  "staff.manage": "Manage staff & access",
};
