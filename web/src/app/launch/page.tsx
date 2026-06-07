import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMyMembership } from "@/lib/enterprise";

// Post-login router. Priority: platform admin → /admin, enterprise member →
// their workspace, everyone else → job-seeker dashboard. Email + OAuth sign-in.
export default async function Launch() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (adminIds.includes(userId)) redirect("/admin");

  const membership = await getMyMembership(userId);
  redirect(membership ? "/enterprise/dashboard" : "/dashboard");
}
