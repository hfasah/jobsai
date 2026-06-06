import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getMyOrg } from "@/lib/enterprise";

export default async function EnterprisePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");
  const org = await getMyOrg(userId);
  redirect(org ? "/enterprise/dashboard" : "/enterprise/onboard");
}
