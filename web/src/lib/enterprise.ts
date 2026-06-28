import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { emailFromName } from "@/lib/email-utils";
import type { EnterpriseOrg, EnterpriseMember } from "@/types/enterprise";

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

export async function getMyOrg(userId: string): Promise<EnterpriseOrg | null> {
  let orgId = await impersonatedOrgId(userId);
  if (!orgId) {
    const { data } = await supabaseAdmin
      .from("enterprise_members")
      .select("org_id")
      .eq("user_id", userId)
      .maybeSingle();
    orgId = data?.org_id ?? null;
  }
  if (!orgId) return null;

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("*")
    .eq("id", orgId)
    .maybeSingle();
  return org ?? null;
}

export async function getMyMembership(userId: string): Promise<EnterpriseMember | null> {
  const demoOrgId = await impersonatedOrgId(userId);
  if (demoOrgId) {
    // Synthetic owner membership — admin acts as owner of the impersonated org.
    return { id: "demo-impersonation", org_id: demoOrgId, user_id: userId, role: "owner", created_at: new Date().toISOString() };
  }
  const { data } = await supabaseAdmin
    .from("enterprise_members")
    .select("*")
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
