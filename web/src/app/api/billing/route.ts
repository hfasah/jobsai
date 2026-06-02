import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getUserBilling,
  getResumeCount,
  getMonthlyJobCount,
  PLAN_LIMITS,
} from "@/lib/billing";

// GET /api/billing — current plan + usage
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [billing, resumeCount, jobCount] = await Promise.all([
    getUserBilling(userId),
    getResumeCount(userId),
    getMonthlyJobCount(userId),
  ]);

  const limits = PLAN_LIMITS[billing.plan];

  return NextResponse.json({
    data: {
      ...billing,
      usage: {
        resumes: { used: resumeCount, limit: limits.max_resumes },
        jobs_this_month: { used: jobCount, limit: limits.max_jobs_per_month },
      },
    },
  });
}
