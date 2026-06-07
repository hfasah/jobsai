import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { UpgradeHost } from "@/components/upgrade-host";
import { getMyMembership } from "@/lib/enterprise";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Enterprise members never sit on the job-seeker dashboard — bounce them to
  // their workspace no matter how they arrived (cached session, direct link, etc.)
  const { userId } = await auth();
  if (userId) {
    const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!adminIds.includes(userId)) {
      const membership = await getMyMembership(userId);
      if (membership) redirect("/enterprise/dashboard");
    }
  }

  return (
    <DashboardShell>
      {children}
      <UpgradeHost />
    </DashboardShell>
  );
}
