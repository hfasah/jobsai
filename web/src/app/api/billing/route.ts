import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  getUserBilling,
  getResumeCount,
  getMonthlyJobCount,
  PLAN_LIMITS,
} from "@/lib/billing";
import { getTokenBalance } from "@/lib/tokens";

// GET /api/billing — current plan + usage
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [billing, resumeCount, jobCount, balance] = await Promise.all([
    getUserBilling(userId),
    getResumeCount(userId),
    getMonthlyJobCount(userId),
    getTokenBalance(userId).catch(() => 0),
  ]);

  const limits = PLAN_LIMITS[billing.plan];

  return NextResponse.json({
    data: {
      ...billing,
      // Token balance so the client can unlock token-metered features (e.g. Agent
      // Apply) for users who bought a token pack but aren't on a subscription.
      balance,
      usage: {
        resumes: { used: resumeCount, limit: limits.max_resumes },
        jobs_this_month: { used: jobCount, limit: limits.max_jobs_per_month },
      },
    },
  });
}
