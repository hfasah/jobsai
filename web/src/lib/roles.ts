import { NextResponse } from "next/server";
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

// API-level guard: returns a 403 NextResponse when the caller is NOT a job seeker
// (i.e. an Admin or Enterprise account), otherwise null. Use in job-seeker write
// endpoints as defense-in-depth so role separation can't be bypassed via the API.
export async function blockNonJobSeeker(userId: string): Promise<NextResponse | null> {
  const role = await getUserRole(userId);
  if (role !== "jobseeker") {
    return NextResponse.json(
      {
        error: `This is ${role === "admin" ? "an Admin" : "an Enterprise"} account — job-seeker features aren't available on this login.`,
        role,
        role_blocked: true,
      },
      { status: 403 }
    );
  }
  return null;
}
