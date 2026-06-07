import { auth, currentUser } from "@clerk/nextjs/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { UpgradeHost } from "@/components/upgrade-host";
import { AccountTypeNotice } from "@/components/account-type-notice";
import { getUserRole } from "@/lib/roles";

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

  return (
    <DashboardShell>
      {children}
      <UpgradeHost />
    </DashboardShell>
  );
}
