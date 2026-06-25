import { auth, clerkClient } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getMyMembership, claimPendingInvites } from "@/lib/enterprise";

// Post-login router. Priority: platform admin → /admin, enterprise member →
// their workspace. Non-members go to enterprise onboarding on the recruiter
// portal (app.jobsai.work), or the job-seeker dashboard on the consumer site.
export default async function Launch() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (adminIds.includes(userId)) redirect("/admin");

  // First login for an admin-invited client: auto-join the org they were invited
  // to (by email) so the shared login link lands them in their workspace.
  try {
    const user = await (await clerkClient()).users.getUser(userId);
    await claimPendingInvites(userId, user.emailAddresses.map((e) => e.emailAddress));
  } catch (e) {
    console.error("[launch] claimPendingInvites failed:", e);
  }

  const membership = await getMyMembership(userId);
  if (membership) redirect("/enterprise/dashboard");

  const host = ((await headers()).get("host") ?? "").split(":")[0];
  const onEnterprisePortal = host === "app.jobsai.work";
  redirect(onEnterprisePortal ? "/enterprise/onboard" : "/dashboard");
}
