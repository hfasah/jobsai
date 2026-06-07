import { getMyMembership } from "@/lib/enterprise";

// One identity = one role. An email registered as an Admin or Enterprise account
// cannot also be used as a job-seeker on the job board (and vice-versa).
export type UserRole = "admin" | "enterprise" | "jobseeker";

export function isAdminId(userId: string): boolean {
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return adminIds.includes(userId);
}

export async function getUserRole(userId: string): Promise<UserRole> {
  if (isAdminId(userId)) return "admin";
  const membership = await getMyMembership(userId);
  if (membership) return "enterprise";
  return "jobseeker";
}
