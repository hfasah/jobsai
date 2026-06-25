import { auth, clerkClient } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getMyMembership, claimPendingInvites } from "@/lib/enterprise";

// Post-login router. Priority: platform admin → /admin, enterprise member →
// their workspace. A signed-in NON-member is NEVER defaulted into enterprise
// account creation: on the recruiter portal (app.jobsai.work) they land on the
// public enterprise landing (explicit "Get started" CTAs → /enterprise/onboard),
// and on the consumer site they go to the job-seeker dashboard. Creating an org
// must be a deliberate choice, not a side effect of logging in.
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
  redirect(onEnterprisePortal ? "/enterprise/home" : "/dashboard");
}
