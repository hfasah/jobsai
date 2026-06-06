import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return adminIds.includes(userId) ? userId : null;
}

const PLAN_MRR: Record<string, number> = { pro: 29, premium: 79, accelerator: 199 };

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const client = await clerkClient();

  // Total users from Clerk
  const totalUsers = await client.users.getCount();

  // New signups
  const now = Date.now();
  const dayAgo   = now - 86_400_000;
  const weekAgo  = now - 7 * 86_400_000;
  const monthAgo = now - 30 * 86_400_000;

  const recentUsers = await client.users.getUserList({ limit: 500, orderBy: "-created_at" });
  const todayCount  = recentUsers.data.filter((u) => u.createdAt > dayAgo).length;
  const weekCount   = recentUsers.data.filter((u) => u.createdAt > weekAgo).length;
  const monthCount  = recentUsers.data.filter((u) => u.createdAt > monthAgo).length;

  // Billing breakdown
  const { data: billing } = await supabaseAdmin
    .from("user_billing")
    .select("plan, subscription_status");

  const active = (billing ?? []).filter((b) => b.subscription_status === "active" || b.subscription_status === "trialing");
  const byPlan: Record<string, number> = {};
  let mrr = 0;
  for (const b of active) {
    byPlan[b.plan] = (byPlan[b.plan] ?? 0) + 1;
    mrr += PLAN_MRR[b.plan] ?? 0;
  }

  // Platform usage
  const [resumes, jobs, churnRows, feedbackRows] = await Promise.all([
    supabaseAdmin.from("resume_documents").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("jobs").select("id", { count: "exact", head: true }),
    supabaseAdmin.from("user_billing").select("id", { count: "exact", head: true })
      .eq("subscription_status", "canceled"),
    supabaseAdmin.from("churn_feedback").select("id", { count: "exact", head: true }),
  ]);

  // Signups per day for last 14 days
  const { data: signupRows } = await supabaseAdmin
    .from("user_billing")
    .select("created_at")
    .gte("created_at", new Date(now - 14 * 86_400_000).toISOString());

  return NextResponse.json({
    totalUsers,
    todayCount,
    weekCount,
    monthCount,
    mrr,
    byPlan,
    totalSubscribers: active.length,
    totalResumes: resumes.count ?? 0,
    totalJobs: jobs.count ?? 0,
    totalChurned: churnRows.count ?? 0,
    totalFeedback: feedbackRows.count ?? 0,
    signupRows: signupRows ?? [],
  });
}
