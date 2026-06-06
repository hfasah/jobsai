import { supabaseAdmin } from "@/lib/supabase";
import type { EnterpriseOrg, EnterpriseMember } from "@/types/enterprise";

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
