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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { userId } = await params;

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(userId).catch(() => null);
  if (!clerkUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const [billing, resumes, jobs, notifications, churnFeedback, applyProfile] = await Promise.all([
    supabaseAdmin.from("user_billing").select("*").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("resume_documents").select("*, active_version:resume_versions!resume_documents_active_version_id_fkey(id, file_name, parse_status, uploaded_at)").eq("user_id", userId).eq("is_archived", false).order("created_at", { ascending: false }),
    supabaseAdmin.from("jobs").select("id, status, created_at, parsed").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("user_notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("churn_feedback").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabaseAdmin.from("apply_profiles").select("auto_apply_enabled, auto_reply, created_at").eq("user_id", userId).maybeSingle(),
  ]);

  const b = billing.data;
  const activePlan =
    b?.subscription_status === "active" || b?.subscription_status === "trialing"
      ? b.plan : "free";

  return NextResponse.json({
    user: {
      id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "—",
      name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "—",
      imageUrl: clerkUser.imageUrl,
      createdAt: clerkUser.createdAt,
      lastActiveAt: clerkUser.lastActiveAt,
    },
    billing: b ? { ...b, plan: activePlan } : null,
    resumes: resumes.data ?? [],
    jobs: jobs.data ?? [],
    notifications: notifications.data ?? [],
    churnFeedback: churnFeedback.data ?? [],
    applyProfile: applyProfile.data ?? null,
  });
}

// PATCH — admin can change a user's plan
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { userId } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.plan) {
    await supabaseAdmin.from("user_billing").upsert(
      { user_id: userId, plan: body.plan, subscription_status: body.plan === "free" ? "inactive" : "active" },
      { onConflict: "user_id" }
    );
  }
  return NextResponse.json({ ok: true });
}
