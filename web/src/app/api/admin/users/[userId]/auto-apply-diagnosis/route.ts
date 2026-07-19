import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return adminIds.includes(userId) ? userId : null;
}

// GET /api/admin/users/[userId]/auto-apply-diagnosis
// Mirrors the consumer auto-apply pipeline's exact decision chain for one user
// so "auto-apply isn't working" tickets are diagnosable in one browser tab:
//   discover cron (8:00 UTC) imports jobs → auto-apply cron (10:00 UTC)
//   processes jobs imported in the last 26h, gated by enabled flag →
//   eligibility (paid sub OR balance ≥ 600) → per-job match score vs threshold
//   → mode routing (auto/hybrid/review).
// Built after two "not a single auto application" tickets where the real
// answer lived across four tables no support view showed together.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { userId } = await params;
  const now = new Date();
  const h26 = new Date(now.getTime() - 26 * 3600_000).toISOString();
  const d7 = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  const [prefsQ, billingQ, tokensQ, jobs26Q, jobs7Q, attemptsQ] = await Promise.all([
    supabaseAdmin.from("user_preferences").select("auto_apply_enabled, auto_apply_mode, auto_apply_threshold, job_titles, keywords, locations").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("user_billing").select("plan, subscription_status").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("user_tokens").select("balance").eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("jobs").select("id, title, company, status, created_at, job_matches!left(match_score), apply_attempts!left(id, status)").eq("user_id", userId).gte("created_at", h26).order("created_at", { ascending: false }).limit(30),
    supabaseAdmin.from("jobs").select("id, created_at").eq("user_id", userId).gte("created_at", d7).order("created_at", { ascending: false }).limit(500),
    supabaseAdmin.from("apply_attempts").select("job_id, status, platform, error_msg, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(15),
  ]);

  const prefs = prefsQ.data as { auto_apply_enabled?: boolean; auto_apply_mode?: string; auto_apply_threshold?: number; job_titles?: string[]; keywords?: string[]; locations?: string[] } | null;
  const billing = billingQ.data as { plan?: string; subscription_status?: string } | null;
  const balance = (tokensQ.data as { balance?: number } | null)?.balance ?? 0;
  const threshold = prefs?.auto_apply_threshold ?? 75;
  const mode = prefs?.auto_apply_mode ?? "hybrid";

  // Cron eligibility — the same two doors the cron checks.
  const paidEligible = !!billing && ["pro", "premium", "accelerator"].includes(billing.plan ?? "") && ["active", "trialing"].includes(billing.subscription_status ?? "");
  const tokenEligible = balance >= 600;

  // Jobs the NEXT cron run would see (imported in last 26h, no attempt yet),
  // with their scores vs the threshold.
  type JobRow = { id: string; title: string | null; company: string | null; status: string | null; created_at: string; job_matches: { match_score: number | null }[] | { match_score: number | null } | null; apply_attempts: { id: string }[] | null };
  const jobs26 = (jobs26Q.data ?? []) as JobRow[];
  const window_jobs = jobs26.map((j) => {
    const m = Array.isArray(j.job_matches) ? j.job_matches[0] : j.job_matches;
    return {
      id: j.id, title: j.title, company: j.company, job_status: j.status, imported_at: j.created_at,
      match_score: m?.match_score ?? null,
      already_attempted: (j.apply_attempts ?? []).length > 0,
      would_auto_apply: (j.apply_attempts ?? []).length === 0 && m?.match_score != null && m.match_score >= threshold && mode !== "review",
    };
  });

  // Import history — is the discover cron feeding this user at all?
  const byDay = new Map<string, number>();
  for (const j of (jobs7Q.data ?? []) as { created_at: string }[]) {
    const day = j.created_at.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  // The verdict, in cron order — first blocker is the answer to the ticket.
  const blockers: string[] = [];
  if (!prefs) blockers.push("No user_preferences row — user never completed setup.");
  if (prefs && !prefs.auto_apply_enabled) blockers.push("auto_apply_enabled is FALSE — the cron never selects this user.");
  if (!paidEligible && !tokenEligible) blockers.push(`Not eligible: no active paid subscription AND balance ${balance} < 600.`);
  if ((prefs?.job_titles?.length ?? 0) === 0 && (prefs?.keywords?.length ?? 0) === 0) blockers.push("No job_titles or keywords — the DISCOVER cron skips this user, so no jobs are ever imported for auto-apply.");
  if (window_jobs.length === 0) blockers.push("Zero jobs imported in the last 26h — the auto-apply cron had NOTHING to process at its last run (check discovery: import history below).");
  const unattempted = window_jobs.filter((j) => !j.already_attempted);
  if (unattempted.length > 0 && unattempted.every((j) => j.match_score == null || j.match_score < threshold)) {
    blockers.push(`Jobs exist but ALL score below the ${threshold} threshold (mode=${mode}) — they are queued for review silently, no attempt rows are created.`);
  }
  if (mode === "review") blockers.push("Mode is 'review' — the cron only queues jobs for approval, never auto-applies.");

  return NextResponse.json({
    data: {
      now: now.toISOString(),
      preferences: prefs ? { enabled: prefs.auto_apply_enabled, mode, threshold, job_titles: prefs.job_titles ?? [], keywords: prefs.keywords ?? [], locations: prefs.locations ?? [] } : null,
      eligibility: { plan: billing?.plan ?? null, subscription_status: billing?.subscription_status ?? null, token_balance: balance, paid_eligible: paidEligible, token_eligible: tokenEligible, cron_selects_user: !!prefs?.auto_apply_enabled && (paidEligible || tokenEligible) },
      jobs_last_26h: window_jobs,
      imports_by_day_last_7d: Object.fromEntries([...byDay.entries()].sort().reverse()),
      recent_attempts: attemptsQ.data ?? [],
      verdict: blockers.length ? blockers : ["No blockers — the next cron run (10:00 UTC) should attempt the eligible jobs listed above."],
    },
  });
}
