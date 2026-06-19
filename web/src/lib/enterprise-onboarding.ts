import { supabaseAdmin } from "@/lib/supabase";

export interface OnboardingStep { key: string; label: string; done: boolean; href: string }

// Onboarding progress, computed from real org data (Step 8 of the journey).
export async function getOnboardingStatus(orgId: string): Promise<{ steps: OnboardingStep[]; complete: number; total: number }> {
  const { data: members } = await supabaseAdmin.from("enterprise_members").select("user_id").eq("org_id", orgId);
  const userIds = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);

  const countOrg = async (table: string): Promise<number> => {
    const { count } = await supabaseAdmin.from(table).select("id", { count: "exact", head: true }).eq("org_id", orgId);
    return count ?? 0;
  };

  let oauth = 0;
  if (userIds.length) {
    const { count } = await supabaseAdmin
      .from("enterprise_oauth_accounts")
      .select("user_id", { count: "exact", head: true })
      .in("user_id", userIds);
    oauth = count ?? 0;
  }
  const connected = oauth > 0; // Google/Microsoft OAuth covers mail + calendar

  const [jobs, invites, candidates, outreach, sourcing] = await Promise.all([
    countOrg("enterprise_jobs"),
    countOrg("enterprise_invitations"),
    countOrg("enterprise_applications"),
    countOrg("enterprise_outreach_log"),
    countOrg("enterprise_sourcing_outreach"),
  ]);

  // ATS connection (counted on org_id since the table is keyed per org).
  const { count: atsCount } = await supabaseAdmin
    .from("enterprise_ats_connections")
    .select("org_id", { count: "exact", head: true })
    .eq("org_id", orgId);
  const atsConnected = (atsCount ?? 0) > 0;

  const steps: OnboardingStep[] = [
    { key: "gmail", label: "Connect Gmail", done: connected, href: "/enterprise/settings" },
    { key: "calendar", label: "Connect your calendar", done: connected, href: "/enterprise/settings" },
    { key: "ats", label: "Connect your existing ATS (optional)", done: atsConnected, href: "/enterprise/ats" },
    { key: "job", label: "Create your first job", done: jobs > 0, href: "/enterprise/jobs" },
    { key: "invite", label: "Invite a team member", done: invites > 0 || userIds.length > 1, href: "/enterprise/team" },
    { key: "candidates", label: "Review AI candidate picks", done: candidates > 0, href: "/enterprise/candidates" },
    { key: "outreach", label: "Launch your first outreach campaign", done: outreach > 0 || sourcing > 0, href: "/enterprise/sourcing" },
  ];
  return { steps, complete: steps.filter((s) => s.done).length, total: steps.length };
}
