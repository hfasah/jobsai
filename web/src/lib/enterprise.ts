import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import type { EnterpriseOrg, EnterpriseMember } from "@/types/enterprise";

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
  const { data } = await supabaseAdmin
    .from("enterprise_members")
    .select("org_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("*")
    .eq("id", data.org_id)
    .maybeSingle();
  return org ?? null;
}

export async function getMyMembership(userId: string): Promise<EnterpriseMember | null> {
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

export async function uniqueSlug(base: string): Promise<string> {
  let slug = slugify(base);
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
