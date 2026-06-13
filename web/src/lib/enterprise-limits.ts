import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyMembership } from "@/lib/enterprise";
import { getOrgEntitlements } from "@/lib/enterprise-entitlements";

const LABELS: Record<string, string> = {
  recruiters: "recruiter seats",
  jobs: "active jobs",
  candidates: "candidates",
};

// Current usage across all metered limits (for the billing/usage display).
export async function getOrgUsage(orgId: string): Promise<Record<string, number>> {
  const [recruiters, jobs, candidates] = await Promise.all([
    countUsage(orgId, "recruiters"),
    countUsage(orgId, "jobs"),
    countUsage(orgId, "candidates"),
  ]);
  return { recruiters, jobs, candidates };
}

// Current usage for a limit key, counted against the org's actual data.
async function countUsage(orgId: string, limitKey: string): Promise<number> {
  if (limitKey === "recruiters") {
    const [members, invites] = await Promise.all([
      supabaseAdmin.from("enterprise_members").select("id", { count: "exact", head: true }).eq("org_id", orgId),
      supabaseAdmin.from("enterprise_invitations").select("id", { count: "exact", head: true }).eq("org_id", orgId),
    ]);
    return (members.count ?? 0) + (invites.count ?? 0);
  }
  if (limitKey === "jobs") {
    const { count } = await supabaseAdmin
      .from("enterprise_jobs")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .neq("status", "closed");
    return count ?? 0;
  }
  if (limitKey === "candidates") {
    const { count } = await supabaseAdmin
      .from("enterprise_applications")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId);
    return count ?? 0;
  }
  return 0;
}

// Route guard (plan-limit layer). Returns a 401/403 NextResponse to return
// early, or null when adding `adding` more of `limitKey` stays within the org's
// plan limit. -1 / missing limit = unlimited. Fails OPEN on error.
export async function enforceLimit(
  userId: string | null,
  limitKey: string,
  adding = 1,
): Promise<NextResponse | null> {
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const member = await getMyMembership(userId);
    if (!member) return NextResponse.json({ error: "Not an enterprise member." }, { status: 403 });

    const ent = await getOrgEntitlements(member.org_id);
    const limit = ent.limits[limitKey];
    if (limit === undefined || limit < 0) return null; // unlimited / unknown

    const used = await countUsage(member.org_id, limitKey);
    if (used + adding > limit) {
      return NextResponse.json(
        {
          error: `You've reached your plan limit of ${limit} ${LABELS[limitKey] ?? limitKey}. Upgrade your plan to add more.`,
          limit,
          used,
          limitKey,
          upgrade: true,
        },
        { status: 403 },
      );
    }
    return null;
  } catch {
    return null; // fail open
  }
}
