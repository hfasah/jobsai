import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { addTokens, getTokenAccount } from "@/lib/tokens";
import { getStripe } from "@/lib/stripe";
import { createNotification } from "@/lib/notifications";

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

  // Token balance + recent ledger (credits/refunds audit trail).
  const [tokenAccount, ledger] = await Promise.all([
    getTokenAccount(userId).catch(() => null),
    supabaseAdmin.from("token_ledger").select("delta, balance_after, reason, feature, metadata, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(15),
  ]);

  return NextResponse.json({
    user: {
      id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress ?? "—",
      name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "—",
      imageUrl: clerkUser.imageUrl,
      createdAt: clerkUser.createdAt,
      lastActiveAt: clerkUser.lastActiveAt,
      banned: Boolean((clerkUser.privateMetadata as { suspended?: boolean } | undefined)?.suspended),
    },
    billing: b ? { ...b, plan: activePlan } : null,
    tokens: tokenAccount ? { balance: tokenAccount.balance, plan: tokenAccount.plan } : null,
    ledger: ledger.data ?? [],
    resumes: resumes.data ?? [],
    jobs: jobs.data ?? [],
    notifications: notifications.data ?? [],
    churnFeedback: churnFeedback.data ?? [],
    applyProfile: applyProfile.data ?? null,
  });
}

// POST — admin support actions: grant credits, or (exceptionally) money refunds.
// Body: { action: "grant_credit", amount, reason }
//   or  { action: "refund", payment_intent_id?, charge_id?, reason, amount? }
export async function POST(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { userId } = await params;
  const body = await req.json().catch(() => ({}));

  // ── Grant credits (the default, preferred remedy) ──────────────────────────
  if (body.action === "grant_credit") {
    const amount = Math.round(Number(body.amount));
    const reason = (body.reason as string | undefined)?.trim() || "Goodwill credit";
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000) {
      return NextResponse.json({ error: "Enter a valid token amount." }, { status: 400 });
    }
    const balance = await addTokens(userId, amount, "admin_credit", { reason, by: adminId });
    createNotification(userId, "plan_upgraded", "Credits added", `We've added ${amount.toLocaleString()} tokens to your account: ${reason}.`, { amount, reason }).catch(() => {});
    return NextResponse.json({ ok: true, balance });
  }

  // ── Money refund (exceptional — via Stripe) ────────────────────────────────
  if (body.action === "refund") {
    const reason = (body.reason as string | undefined)?.trim() || "requested_by_customer";
    const payment_intent = (body.payment_intent_id as string | undefined)?.trim();
    const charge = (body.charge_id as string | undefined)?.trim();
    if (!payment_intent && !charge) {
      return NextResponse.json({ error: "Provide a Stripe payment intent or charge id to refund." }, { status: 400 });
    }
    const cents = body.amount ? Math.round(Number(body.amount) * 100) : undefined;
    try {
      const refund = await getStripe().refunds.create({
        ...(payment_intent ? { payment_intent } : {}),
        ...(charge ? { charge } : {}),
        ...(cents ? { amount: cents } : {}),
        reason: "requested_by_customer",
        metadata: { note: reason, by: adminId },
      });
      // Audit trail in the token ledger (0-delta marker — no token change).
      const acct = await getTokenAccount(userId).catch(() => null);
      await supabaseAdmin.from("token_ledger").insert({
        user_id: userId, delta: 0, balance_after: acct?.balance ?? 0,
        reason: "admin_money_refund", feature: "admin_money_refund",
        metadata: { stripe_refund_id: refund.id, amount: refund.amount, currency: refund.currency, note: reason, by: adminId },
      });
      createNotification(userId, "plan_upgraded", "Refund issued", `A refund of ${(refund.amount / 100).toFixed(2)} ${refund.currency.toUpperCase()} has been processed.`, { refund_id: refund.id }).catch(() => {});
      return NextResponse.json({ ok: true, refund_id: refund.id, amount: refund.amount, currency: refund.currency });
    } catch (err) {
      console.error("Admin refund error:", err);
      return NextResponse.json({ error: err instanceof Error ? err.message : "Refund failed." }, { status: 422 });
    }
  }

  // ── Suspend / reactivate the account ───────────────────────────────────────
  // Uses a Clerk privateMetadata flag (free) which the consumer app enforces,
  // rather than Clerk's paywalled banUser (returns 402 "Payment Required").
  if (body.action === "ban" || body.action === "unban") {
    if (userId === adminId) {
      return NextResponse.json({ error: "You can't suspend your own account." }, { status: 400 });
    }
    const suspend = body.action === "ban";
    const client = await clerkClient();
    try {
      await client.users.updateUserMetadata(userId, {
        privateMetadata: { suspended: suspend, suspended_at: suspend ? new Date().toISOString() : null, suspended_by: suspend ? adminId : null },
      });
    } catch (err) {
      console.error("Admin suspend/reactivate error:", err);
      return NextResponse.json({ error: err instanceof Error ? err.message : "Action failed." }, { status: 422 });
    }
    return NextResponse.json({ ok: true, banned: suspend });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
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

// DELETE — permanently remove the account and ALL its data (irreversible).
// Requires body { confirm_email } to exactly match the account's email.
//   1. delete the user's resume files from storage,
//   2. delete every DB row keyed by user_id (admin_delete_user_data fn),
//   3. delete the Clerk login.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { userId } = await params;
  if (userId === adminId) {
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const client = await clerkClient();
  const target = await client.users.getUser(userId).catch(() => null);
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const email = target.emailAddresses[0]?.emailAddress ?? "";
  const confirm = String(body.confirm_email ?? "").trim().toLowerCase();
  if (!confirm || confirm !== email.toLowerCase()) {
    return NextResponse.json({ error: "Type the account's email exactly to confirm deletion." }, { status: 400 });
  }

  // 1. Remove resume files from storage (keys embed the user id, e.g. tag/uid/doc).
  let filesRemoved = 0;
  try {
    const { data: docs } = await supabaseAdmin.from("resume_documents").select("id").eq("user_id", userId);
    const docIds = (docs ?? []).map((d) => d.id);
    if (docIds.length) {
      const { data: versions } = await supabaseAdmin
        .from("resume_versions").select("storage_key").in("document_id", docIds);
      const keys = (versions ?? []).map((v) => v.storage_key).filter(Boolean) as string[];
      if (keys.length) {
        await supabaseAdmin.storage.from(STORAGE_BUCKET).remove(keys);
        filesRemoved = keys.length;
      }
    }
  } catch (e) {
    console.error("delete account: storage cleanup failed:", e);
  }

  // 2. Delete every DB row keyed by this user_id (all tables, dynamic).
  const { data: cleanup, error: rpcErr } = await supabaseAdmin.rpc("admin_delete_user_data", { p_user_id: userId });
  if (rpcErr) {
    console.error("admin_delete_user_data error:", rpcErr);
    return NextResponse.json(
      { error: `Database cleanup failed: ${rpcErr.message}. Has migration 115 (admin_delete_user_data) been run?` },
      { status: 500 },
    );
  }

  // 3. Delete the Clerk login.
  try {
    await client.users.deleteUser(userId);
  } catch (e) {
    console.error("delete account: Clerk deleteUser failed:", e);
    return NextResponse.json(
      { error: "Data was deleted, but removing the Clerk login failed. Retry, or remove it from the Clerk dashboard." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, email, filesRemoved, cleanup });
}
