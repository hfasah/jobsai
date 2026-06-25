import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// Post-login router for the JOB-SEEKER entrance (/sign-in). Platform admin →
// /admin, everyone else → the job-seeker dashboard. Recruiters use the separate
// /enterprise-login door (which redirects to /enterprise), so a job seeker is
// never pulled into the recruiter workspace just for having a membership row.
export default async function Launch() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (adminIds.includes(userId)) redirect("/admin");

  redirect("/dashboard");
}
