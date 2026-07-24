import { auth, currentUser } from "@clerk/nextjs/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { UpgradeHost } from "@/components/upgrade-host";
import { BuyTokensHost } from "@/components/buy-tokens-host";
import { AccountTypeNotice } from "@/components/account-type-notice";
import { SuspendedNotice } from "@/components/suspended-notice";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { TrialConvertBanner } from "@/components/trial-convert-banner";
import { getUserRole } from "@/lib/roles";
import { getUserBilling } from "@/lib/billing";
import { getTokenBalance } from "@/lib/tokens";
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
  let trialStatus = "";
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
    trialStatus = billing.subscription_status ?? "";
    const subscribed = ["active", "trialing", "past_due"].includes(billing.subscription_status ?? "");
    if (!subscribed) {
      // Grandfathered paid-credit customers (bought top-ups / support grants
      // before the card gate) bypass the trial wall — migration 180 backfills
      // the flag, and admins can toggle it per user. Fails closed pre-migration.
      const { data: override, error: overrideError } = await supabaseAdmin
        .from("user_billing")
        .select("dashboard_access_override")
        .eq("user_id", userId)
        .maybeSingle();
      if (overrideError) console.error("[dashboard-gate] override lookup failed:", overrideError.message);
      if (!override?.dashboard_access_override) redirect("/start-trial");
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

  // Convert-on-exhaustion prompt: only meaningful for a trialing user, and only
  // fetch the balance in that case.
  const trialBalance = trialStatus === "trialing" && userId ? await getTokenBalance(userId) : 0;

  return (
    <DashboardShell>
      <OnboardingChecklist
        hasResume={hasResume}
        hasJobPreferences={hasJobPreferences}
        hasApplyProfile={hasApplyProfile}
      />
      {trialStatus === "trialing" && <TrialConvertBanner status={trialStatus} balance={trialBalance} />}
      {children}
      <UpgradeHost />
      <BuyTokensHost />
    </DashboardShell>
  );
}
