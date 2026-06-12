import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import type { EnterpriseOrg, EnterpriseMember } from "@/types/enterprise";

// Company-friendly invite token: "<org-slug>-<short secure suffix>" so the link
// reads as the company name while staying unguessable.
export function inviteToken(slug: string): string {
  const clean = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "team";
  return `${clean}-${randomBytes(8).toString("hex")}`;
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

// Org access gating: statuses that grant a usable workspace.
export const ENTERPRISE_ACTIVE_STATUSES = ["active", "comped", "trialing"] as const;

export function orgHasAccess(accessStatus: string | null | undefined): boolean {
  return !!accessStatus && (ENTERPRISE_ACTIVE_STATUSES as readonly string[]).includes(accessStatus);
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
