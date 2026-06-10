import { auth, currentUser } from "@clerk/nextjs/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { UpgradeHost } from "@/components/upgrade-host";
import { BuyTokensHost } from "@/components/buy-tokens-host";
import { AccountTypeNotice } from "@/components/account-type-notice";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { getUserRole } from "@/lib/roles";
import { supabaseAdmin } from "@/lib/supabase";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Strict role separation: Admin and Enterprise accounts can never use the
  // job-seeker dashboard. Show a friendly notice instead of the job board.
  const { userId } = await auth();
  if (userId) {
    const role = await getUserRole(userId);
    if (role !== "jobseeker") {
      const user = await currentUser();
      const email = user?.emailAddresses?.[0]?.emailAddress;
      return <AccountTypeNotice role={role} email={email} />;
    }
  }

  // Check onboarding completion
  let hasResume = false;
  let hasJobPreferences = false;
  let hasApplyProfile = false;

  if (userId) {
    // Single source of truth: mirror /api/onboard/status exactly so this modal
    // never disagrees with the Setup page.
    const [resumeRes, prefsRes, profileRes] = await Promise.all([
      supabaseAdmin
        .from("resume_documents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_archived", false),
      supabaseAdmin
        .from("user_preferences")
        .select("job_titles")
        .eq("user_id", userId)
        .maybeSingle(),
      supabaseAdmin
        .from("apply_profiles")
        .select("first_name, email")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    hasResume = (resumeRes.count ?? 0) > 0;
    hasJobPreferences = (prefsRes.data?.job_titles?.length ?? 0) > 0;
    hasApplyProfile = !!(profileRes.data?.first_name || profileRes.data?.email);
  }

  return (
    <DashboardShell>
      <OnboardingChecklist
        hasResume={hasResume}
        hasJobPreferences={hasJobPreferences}
        hasApplyProfile={hasApplyProfile}
      />
      {children}
      <UpgradeHost />
      <BuyTokensHost />
    </DashboardShell>
  );
}
