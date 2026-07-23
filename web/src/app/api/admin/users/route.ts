import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { requireAdminPerm } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const ctx = await requireAdminPerm("users.view");
  return ctx ? ctx.userId : null;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const query  = searchParams.get("q") ?? "";
  const plan   = searchParams.get("plan") ?? "all";
  const type   = searchParams.get("type") ?? "all";
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
    .select("user_id, plan, subscription_status, stripe_customer_id, created_at")
    .in("user_id", userIds);

  const billingMap = new Map((billingRows ?? []).map((b) => [b.user_id, b]));

  // Get resume + job counts + enterprise membership
  const [resumeRows, jobRows, memberRows] = await Promise.all([
    supabaseAdmin.from("resume_documents").select("user_id").in("user_id", userIds).eq("is_archived", false),
    supabaseAdmin.from("jobs").select("user_id").in("user_id", userIds),
    supabaseAdmin.from("enterprise_members").select("user_id, role, org_id").in("user_id", userIds),
  ]);

  const resumeCounts = new Map<string, number>();
  for (const r of resumeRows.data ?? []) resumeCounts.set(r.user_id, (resumeCounts.get(r.user_id) ?? 0) + 1);
  const jobCounts = new Map<string, number>();
  for (const j of jobRows.data ?? []) jobCounts.set(j.user_id, (jobCounts.get(j.user_id) ?? 0) + 1);

  // A user is "enterprise" if they belong to an enterprise org. Resolve the org
  // name for a readable badge (a user with multiple orgs shows their first).
  const memberMap = new Map<string, { role: string; org_id: string }>();
  for (const m of memberRows.data ?? []) if (!memberMap.has(m.user_id)) memberMap.set(m.user_id, { role: m.role, org_id: m.org_id });
  const orgIds = [...new Set([...memberMap.values()].map((m) => m.org_id))];
  const { data: orgRows } = orgIds.length
    ? await supabaseAdmin.from("enterprise_orgs").select("id, name").in("id", orgIds)
    : { data: [] };
  const orgNames = new Map((orgRows ?? []).map((o) => [o.id, o.name as string]));

  let users = clerkRes.data.map((u) => {
    const billing = billingMap.get(u.id);
    const status = billing?.subscription_status ?? null;
    const activePlan =
      status === "active" || status === "trialing" || status === "past_due"
        ? billing?.plan ?? null
        : null;
    // Billing truth for the admin list. There is no free tier: a consumer either
    // completed card-required checkout (trialing/active/past_due/canceled) or
    // never did. A Stripe customer with no subscription means they clicked
    // through to checkout but bailed before entering a card.
    const billingState =
      status === "active" ? "active"
      : status === "trialing" ? "trialing"
      : status === "past_due" ? "past_due"
      : status === "canceled" ? "canceled"
      : billing?.stripe_customer_id ? "abandoned_checkout"
      : "signup_only";
    const member = memberMap.get(u.id);
    return {
      id: u.id,
      email: u.emailAddresses[0]?.emailAddress ?? "—",
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || "—",
      plan: activePlan,
      billingState,
      subscriptionStatus: status ?? "inactive",
      createdAt: u.createdAt,
      lastActiveAt: u.lastActiveAt,
      resumeCount: resumeCounts.get(u.id) ?? 0,
      jobCount: jobCounts.get(u.id) ?? 0,
      imageUrl: u.imageUrl,
      suspended: Boolean((u.privateMetadata as { suspended?: boolean } | undefined)?.suspended),
      // Account type: enterprise (org member) vs consumer (job seeker).
      type: member ? "enterprise" : "consumer",
      orgName: member ? (orgNames.get(member.org_id) ?? "Enterprise") : null,
      orgRole: member?.role ?? null,
    };
  });

  // The `plan` filter accepts either a plan slug (pro/premium/accelerator) or a
  // billing state (signup_only/abandoned_checkout/trialing/active/past_due/canceled).
  const PLAN_SLUGS = new Set(["pro", "premium", "accelerator"]);
  if (plan !== "all") {
    users = PLAN_SLUGS.has(plan)
      ? users.filter((u) => u.plan === plan)
      : users.filter((u) => u.billingState === plan);
  }
  if (type !== "all") users = users.filter((u) => u.type === type);

  return NextResponse.json({ users, total: clerkRes.totalCount, page, pages: Math.ceil(clerkRes.totalCount / limit) });
}
