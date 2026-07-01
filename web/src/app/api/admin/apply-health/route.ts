import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function requireAdmin(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return adminIds.includes(userId);
}

const STUCK_MS = 60 * 60 * 1000; // pending older than 1h = webhook never landed

// GET ?days=30 — system-wide auto-apply health for the super-admin.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const days = Math.min(365, Math.max(1, parseInt(req.nextUrl.searchParams.get("days") ?? "30")));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("apply_attempts")
    .select("id, user_id, job_id, platform, status, error_msg, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const attempts = rows ?? [];
  const now = Date.now();
  const isStuck = (a: { status: string; created_at: string }) => a.status === "pending" && now - new Date(a.created_at).getTime() > STUCK_MS;

  const submitted = attempts.filter((a) => a.status === "submitted").length;
  const failed = attempts.filter((a) => a.status === "failed").length;
  const manual = attempts.filter((a) => a.status === "manual_required").length;
  const stuck = attempts.filter(isStuck).length;
  const pending = attempts.filter((a) => a.status === "pending" && !isStuck(a)).length;
  const resolved = submitted + failed;
  const successRate = resolved > 0 ? Math.round((submitted / resolved) * 100) : null;

  // Failure reasons (coarse — apply_attempts.error_msg holds "Agent status: <x>").
  const reasonCounts = new Map<string, number>();
  for (const a of attempts) {
    if (a.status !== "failed") continue;
    const key = (a.error_msg || "Unknown").replace(/^Agent status:\s*/i, "").trim() || "Unknown";
    reasonCounts.set(key, (reasonCounts.get(key) ?? 0) + 1);
  }
  const failureReasons = [...reasonCounts.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);

  // Platform breakdown.
  const platformCounts = new Map<string, { total: number; submitted: number; failed: number }>();
  for (const a of attempts) {
    const p = platformCounts.get(a.platform) ?? { total: 0, submitted: 0, failed: 0 };
    p.total++;
    if (a.status === "submitted") p.submitted++;
    if (a.status === "failed") p.failed++;
    platformCounts.set(a.platform, p);
  }
  const platforms = [...platformCounts.entries()].map(([platform, v]) => ({ platform, ...v })).sort((a, b) => b.total - a.total);

  // Tokens refunded (Skyvern launch failures) over the same window.
  const { data: refundRows } = await supabaseAdmin
    .from("token_ledger").select("delta").eq("reason", "auto_apply_refund").gte("created_at", since);
  const tokensRefunded = (refundRows ?? []).reduce((s, r) => s + Number(r.delta || 0), 0);

  // Recent failures / stuck feed (enrich with email, bounded).
  const feedRows = attempts.filter((a) => a.status === "failed" || isStuck(a)).slice(0, 25);
  const uniqUsers = [...new Set(feedRows.map((a) => a.user_id))];
  const emailMap = new Map<string, string>();
  try {
    const client = await clerkClient();
    await Promise.all(uniqUsers.map(async (uid) => {
      const u = await client.users.getUser(uid).catch(() => null);
      if (u) emailMap.set(uid, u.emailAddresses[0]?.emailAddress ?? uid);
    }));
  } catch { /* email enrichment is best-effort */ }
  const feed = feedRows.map((a) => ({
    id: a.id, user_id: a.user_id, email: emailMap.get(a.user_id) ?? a.user_id,
    platform: a.platform, status: isStuck(a) ? "stuck" : a.status,
    error_msg: a.error_msg, created_at: a.created_at,
  }));

  return NextResponse.json({
    days,
    stats: { total: attempts.length, submitted, failed, manual_required: manual, pending, stuck, successRate, tokensRefunded },
    failureReasons,
    platforms,
    feed,
  });
}
