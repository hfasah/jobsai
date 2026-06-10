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
    // Check resume
    const { count: resumeCount } = await supabaseAdmin
      .from("resume_documents")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .eq("is_archived", false);
    hasResume = (resumeCount ?? 0) > 0;

    // Check job preferences
    const { data: prefs } = await supabaseAdmin
      .from("user_job_preferences")
      .select("id")
      .eq("user_id", userId)
      .single();
    hasJobPreferences = !!prefs;

    // Check apply profile
    const { data: profile } = await supabaseAdmin
      .from("apply_profiles")
      .select("id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .single();
    hasApplyProfile = !!profile;
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
