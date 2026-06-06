import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return adminIds.includes(userId) ? userId : null;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const query  = searchParams.get("q") ?? "";
  const plan   = searchParams.get("plan") ?? "all";
  const page   = parseInt(searchParams.get("page") ?? "1");
  const limit  = 50;
  const offset = (page - 1) * limit;

  const client = await clerkClient();

  // Fetch users from Clerk
  const clerkRes = await client.users.getUserList({
    limit,
    offset,
    ...(query ? { query } : {}),
    orderBy: "-created_at",
  });

  const userIds = clerkRes.data.map((u) => u.id);

  // Get billing for all these users
  const { data: billingRows } = await supabaseAdmin
    .from("user_billing")
    .select("user_id, plan, subscription_status, created_at")
    .in("user_id", userIds);

  const billingMap = new Map((billingRows ?? []).map((b) => [b.user_id, b]));

  // Get resume + job counts
  const [resumeRows, jobRows] = await Promise.all([
    supabaseAdmin.from("resume_documents").select("user_id").in("user_id", userIds).eq("is_archived", false),
    supabaseAdmin.from("jobs").select("user_id").in("user_id", userIds),
  ]);

  const resumeCounts = new Map<string, number>();
  for (const r of resumeRows.data ?? []) resumeCounts.set(r.user_id, (resumeCounts.get(r.user_id) ?? 0) + 1);
  const jobCounts = new Map<string, number>();
  for (const j of jobRows.data ?? []) jobCounts.set(j.user_id, (jobCounts.get(j.user_id) ?? 0) + 1);

  let users = clerkRes.data.map((u) => {
    const billing = billingMap.get(u.id);
    const activePlan =
      billing?.subscription_status === "active" || billing?.subscription_status === "trialing"
        ? billing.plan
        : "free";
    return {
      id: u.id,
      email: u.emailAddresses[0]?.emailAddress ?? "—",
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || "—",
      plan: activePlan,
      subscriptionStatus: billing?.subscription_status ?? "inactive",
      createdAt: u.createdAt,
      lastActiveAt: u.lastActiveAt,
      resumeCount: resumeCounts.get(u.id) ?? 0,
      jobCount: jobCounts.get(u.id) ?? 0,
      imageUrl: u.imageUrl,
    };
  });

  if (plan !== "all") users = users.filter((u) => u.plan === plan);

  return NextResponse.json({ users, total: clerkRes.totalCount, page, pages: Math.ceil(clerkRes.totalCount / limit) });
}
