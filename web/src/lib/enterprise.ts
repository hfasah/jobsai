import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { emailFromName } from "@/lib/email-utils";
import type { EnterpriseOrg, EnterpriseMember, MemberRole } from "@/types/enterprise";

const INTAKE_DOMAIN = process.env.ENTERPRISE_INTAKE_DOMAIN || "talent.jobsai.work";

// The org's intake mailbox, e.g. "investorclub100@talent.jobsai.work" — where
// candidate replies are received and captured back into JobsAI (the inbound
// webhook). Built from the custom handle, falling back to the slug.
export function orgIntakeAddress(slug: string | null | undefined, handle?: string | null): string | null {
  const h = (handle ?? slug ?? "").toLowerCase().trim();
  return h ? `${h}@${INTAKE_DOMAIN}` : null;
}

// The verified mailbox we send candidate-facing email FROM. Defaults to JobsAI's
// verified domain; once the intake domain (talent.jobsai.work) is verified for
// SENDING in Resend, set ENTERPRISE_SEND_FROM_INTAKE=true to send as the org's
// own intake address so support@jobsai.work never appears on candidate email.
export function enterpriseSenderEmail(intakeAddr: string | null): string {
  return process.env.ENTERPRISE_SEND_FROM_INTAKE === "true" && intakeAddr ? intakeAddr : "support@jobsai.work";
}

// Branded From + Reply-To for a candidate-facing platform email. Reply-To always
// routes to a real inbox the org controls — an explicit reply_to_email if set,
// otherwise the org's intake address (so replies are captured in JobsAI), never
// support@jobsai.work. Use:
//   const { from, replyTo } = await enterpriseMailMeta(orgId);
//   await resend.emails.send({ from, replyTo, to, subject, html });
export async function enterpriseMailMeta(orgId: string): Promise<{ from: string; replyTo?: string }> {
  const { data } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("name, white_label_email_from, reply_to_email, contact_email, slug, intake_email_handle")
    .eq("id", orgId)
    .maybeSingle();
  const name = (data?.name as string) || "Recruiting";
  const fromName = emailFromName(name, data?.white_label_email_from as string | null);
  const intake = orgIntakeAddress(data?.slug as string | null, data?.intake_email_handle as string | null);
  const from = `${fromName} <${enterpriseSenderEmail(intake)}>`;
  const replyTo = ((data?.reply_to_email as string) || intake || (data?.contact_email as string) || "").trim() || undefined;
  return { from, replyTo };
}

// Super-admin "Open workspace": a cookie names an org and overrides normal
// membership resolution so a super-admin can enter any workspace for demos —
// WITHOUT creating membership rows (so it never collides with the single-org
// model). Only honored for ADMIN_USER_IDS; a forged cookie does nothing.
export const DEMO_ORG_COOKIE = "demo_org_id";

function isSuperAdmin(userId: string): boolean {
  const ids = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return ids.includes(userId);
}

async function impersonatedOrgId(userId: string): Promise<string | null> {
  if (!isSuperAdmin(userId)) return null;
  try {
    return (await cookies()).get(DEMO_ORG_COOKIE)?.value || null;
  } catch {
    return null; // not in a request scope (e.g. cron) — ignore
  }
}

// Agency workspaces: the user's currently-selected client workspace. A member
// of multiple orgs (an agency parent + its client workspaces) picks which one
// they're operating in; the cookie names it.
export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

async function activeWorkspaceCookie(): Promise<string | null> {
  try {
    return (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value || null;
  } catch {
    return null; // cron / no request scope
  }
}

export interface ResolvedOrg {
  orgId: string;
  role: string;       // effective role in that org (direct, or inherited from parent)
  synthetic: boolean; // true when membership is inherited (parent admin) or impersonated
}

// Every org the user can operate in, with their effective role:
//   - direct memberships (their enterprise_members rows), plus
//   - client workspaces (child orgs) of any parent where they are owner/admin —
//     an agency admin reaches all their clients without a row in each.
async function accessibleOrgs(userId: string): Promise<Map<string, { role: string; direct: boolean }>> {
  const map = new Map<string, { role: string; direct: boolean }>();

  const { data: memberships } = await supabaseAdmin
    .from("enterprise_members")
    .select("org_id, role, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .order("org_id", { ascending: true });
  const rows = (memberships ?? []) as { org_id: string; role: string }[];
  for (const m of rows) map.set(m.org_id, { role: m.role, direct: true });

  // Inherit into child workspaces of any parent org the user administers.
  const adminParents = rows.filter((m) => m.role === "owner" || m.role === "admin").map((m) => m.org_id);
  if (adminParents.length > 0) {
    const { data: children } = await supabaseAdmin
      .from("enterprise_orgs")
      .select("id, parent_org_id")
      .in("parent_org_id", adminParents);
    for (const c of (children ?? []) as { id: string; parent_org_id: string }[]) {
      if (map.has(c.id)) continue; // a direct membership wins over inherited
      const parentRole = map.get(c.parent_org_id)?.role ?? "admin";
      map.set(c.id, { role: parentRole, direct: false });
    }
  }
  return map;
}

// Resolve which org the request operates in. Order: super-admin impersonation →
// active-workspace selection (when the user belongs to several) → the single
// membership. The single-membership path is kept identical to the pre-O4
// behavior (one query, no children lookup) so nothing regresses for the ~all
// standalone orgs.
export async function resolveActiveOrg(userId: string): Promise<ResolvedOrg | null> {
  const impersonated = await impersonatedOrgId(userId);
  if (impersonated) return { orgId: impersonated, role: "owner", synthetic: true };

  // ORDER BY created_at is REQUIRED: without a stable order a multi-membership
  // user resolves to a DIFFERENT org on each request (Postgres returns rows in
  // arbitrary order), which silently switches their whole workspace between
  // page loads — the "estimate shows 2500, search sees 0" bug. Oldest
  // membership = the user's primary org, and it's stable.
  const { data: memberships } = await supabaseAdmin
    .from("enterprise_members")
    .select("org_id, role, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .order("org_id", { ascending: true }); // tiebreak when created_at ties
  const rows = (memberships ?? []) as { org_id: string; role: string }[];
  const cookieId = await activeWorkspaceCookie();

  // Hot path: exactly one membership and no workspace selection → as before.
  if (rows.length <= 1 && !cookieId) {
    const m = rows[0];
    return m ? { orgId: m.org_id, role: m.role, synthetic: false } : null;
  }

  // Multi-workspace (or an explicit selection): compute the full accessible set.
  const accessible = await accessibleOrgs(userId);
  if (accessible.size === 0) return null;

  if (cookieId && accessible.has(cookieId)) {
    const a = accessible.get(cookieId)!;
    return { orgId: cookieId, role: a.role, synthetic: !a.direct };
  }

  // Default (no valid cookie): prefer the user's OLDEST top-level direct
  // membership (their primary org / agency parent), else their oldest direct
  // membership. `rows` is already ordered oldest-first, so the first match is
  // deterministic across requests.
  const directIds = rows.map((r) => r.org_id);
  if (directIds.length > 0) {
    const { data: tops } = await supabaseAdmin
      .from("enterprise_orgs")
      .select("id")
      .in("id", directIds)
      .is("parent_org_id", null);
    const topSet = new Set(((tops as { id: string }[] | null) ?? []).map((t) => t.id));
    const topId = directIds.find((id) => topSet.has(id)) ?? directIds[0];
    const a = accessible.get(topId)!;
    return { orgId: topId, role: a.role, synthetic: !a.direct };
  }
  const [firstId, first] = [...accessible.entries()][0];
  return { orgId: firstId, role: first.role, synthetic: !first.direct };
}

// Company-friendly invite token: "<org-slug>-<short secure suffix>" so the link
// reads as the company name while staying unguessable.
export function inviteToken(slug: string): string {
  const clean = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "team";
  return `${clean}-${randomBytes(8).toString("hex")}`;
}

// Auto-join any enterprise org this user was invited to by email. The admin
// "create org from intake" flow writes an enterprise_invitations row for the
// primary contact; once that person creates a Clerk account (any sign-up), this
// joins them to the org on their first login — so the shared login link works
// for a brand-new client instead of dead-ending at "couldn't find your account"
// or sending them to create a second, empty org. Returns true if anything joined.
export async function claimPendingInvites(userId: string, emails: string[]): Promise<boolean> {
  const lower = emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (lower.length === 0) return false;

  const { data: invites } = await supabaseAdmin
    .from("enterprise_invitations")
    .select("id, org_id, role")
    .in("email", lower)
    .is("accepted_at", null);
  if (!invites?.length) return false;

  let joined = false;
  for (const inv of invites) {
    const { data: existing } = await supabaseAdmin
      .from("enterprise_members")
      .select("id")
      .eq("org_id", inv.org_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!existing) {
      const { error } = await supabaseAdmin
        .from("enterprise_members")
        .insert({ org_id: inv.org_id, user_id: userId, role: inv.role ?? "owner" });
      if (error) { console.error("[claimPendingInvites] join failed:", error.message); continue; }
    }
    await supabaseAdmin
      .from("enterprise_invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", inv.id);
    joined = true;
  }
  return joined;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string | null;
  parent_org_id: string | null;
  role: string;
  is_agency_parent: boolean;  // top-level org that has client workspaces
  is_current: boolean;
}

// All workspaces the user can switch between (direct + inherited client
// workspaces), for the workspace switcher. Only meaningful for agency users;
// a standalone org returns a single entry.
export async function getMyWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  const accessible = await accessibleOrgs(userId);
  if (accessible.size === 0) return [];
  const ids = [...accessible.keys()];
  const { data: orgs } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("id, name, slug, parent_org_id")
    .in("id", ids);
  const rows = (orgs ?? []) as { id: string; name: string; slug: string | null; parent_org_id: string | null }[];
  const parentIds = new Set(rows.map((r) => r.parent_org_id).filter(Boolean) as string[]);
  const active = await resolveActiveOrg(userId);
  return rows
    .map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      parent_org_id: o.parent_org_id,
      role: accessible.get(o.id)?.role ?? "viewer",
      is_agency_parent: o.parent_org_id === null && parentIds.has(o.id),
      is_current: active?.orgId === o.id,
    }))
    // parent first, then client workspaces by name
    .sort((a, b) => (a.parent_org_id === null ? -1 : 1) - (b.parent_org_id === null ? -1 : 1) || a.name.localeCompare(b.name));
}

export async function getMyOrg(userId: string): Promise<EnterpriseOrg | null> {
  const resolved = await resolveActiveOrg(userId);
  if (!resolved) return null;

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("*")
    .eq("id", resolved.orgId)
    .maybeSingle();
  return org ?? null;
}

export async function getMyMembership(userId: string): Promise<EnterpriseMember | null> {
  const resolved = await resolveActiveOrg(userId);
  if (!resolved) return null;

  // Synthetic membership when access is impersonated or inherited from a parent
  // org (agency admin operating in a client workspace they have no row in).
  if (resolved.synthetic) {
    return { id: "synthetic", org_id: resolved.orgId, user_id: userId, role: resolved.role as MemberRole, created_at: new Date().toISOString() };
  }
  const { data } = await supabaseAdmin
    .from("enterprise_members")
    .select("*")
    .eq("org_id", resolved.orgId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
}

// Org access gating: statuses that grant a usable workspace. `past_due` keeps
// access during Stripe's retry/dunning window (grace); the org only locks once
// Stripe gives up and the subscription is canceled/unpaid.
export const ENTERPRISE_ACTIVE_STATUSES = ["active", "comped", "trialing", "past_due"] as const;

export function orgHasAccess(accessStatus: string | null | undefined): boolean {
  return !!accessStatus && (ENTERPRISE_ACTIVE_STATUSES as readonly string[]).includes(accessStatus);
}

export async function uniqueSlug(base: string): Promise<string> {
  const slug = slugify(base);
  let suffix = 0;
  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const { count } = await supabaseAdmin
      .from("enterprise_orgs")
      .select("id", { count: "exact", head: true })
      .eq("slug", candidate);
    if (!count) return candidate;
    suffix++;
  }
}
