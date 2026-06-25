import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMyOrg } from "@/lib/enterprise";

export default async function EnterprisePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const org = await getMyOrg(userId);
  if (org) redirect("/enterprise/dashboard");

  // Platform admins manage orgs from the admin portal — never the recruiter
  // onboard. (A super-admin "opening" a workspace uses the demo cookie, which
  // getMyOrg honors above, so this only catches admins with no active org.)
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (adminIds.includes(userId)) redirect("/admin");

  redirect("/enterprise/onboard");
}
