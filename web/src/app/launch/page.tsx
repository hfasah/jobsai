import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/enterprise";

// Post-login router: enterprise members land in their workspace, everyone else
// in the job-seeker dashboard. Works for email + Google OAuth sign-in.
export default async function Launch() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const membership = await getMyMembership(userId);
  redirect(membership ? "/enterprise/dashboard" : "/dashboard");
}
