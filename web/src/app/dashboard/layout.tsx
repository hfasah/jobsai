import { auth, currentUser } from "@clerk/nextjs/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { UpgradeHost } from "@/components/upgrade-host";
import { BuyTokensHost } from "@/components/buy-tokens-host";
import { AccountTypeNotice } from "@/components/account-type-notice";
import { SuspendedNotice } from "@/components/suspended-notice";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { getUserRole } from "@/lib/roles";
import { getUserBilling } from "@/lib/billing";
import { supabaseAdmin } from "@/lib/supabase";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Strict role separation: Admin and Enterprise accounts can never use the
  // job-seeker dashboard. Show a friendly notice instead of the job board.
  const { userId } = await auth();
  if (userId) {
    const user = await currentUser();
    const email = user?.emailAddresses?.[0]?.emailAddress;

    // Admin-suspended accounts (Clerk privateMetadata.suspended) are blocked.
    if ((user?.privateMetadata as { suspended?: boolean } | undefined)?.suspended) {
      return <SuspendedNotice email={email} />;
    }

    const role = await getUserRole(userId);
    if (role !== "jobseeker") {
      return <AccountTypeNotice role={role} email={email} />;
    }

    // Card-required model (2026-07-18): using the dashboard needs an active or
    // trialing subscription. New signups and lapsed accounts go to the trial /
    // plan page instead. past_due gets a grace pass so a failed renewal doesn't
    // lock a paying customer out mid-dunning.
    const billing = await getUserBilling(userId);
    const subscribed = ["active", "trialing", "past_due"].includes(billing.subscription_status ?? "");
    if (!subscribed) redirect("/start-trial");
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
