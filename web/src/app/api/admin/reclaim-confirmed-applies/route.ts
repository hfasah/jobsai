import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { reclaimConfirmedApply } from "@/lib/agent-cost";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Auth: a super-admin (ADMIN_USER_IDS) OR an Authorization: Bearer <CRON_SECRET>
// so this one-time backfill can be triggered from the CLI or the admin.
async function authorized(req: NextRequest): Promise<boolean> {
  const bearer = req.headers.get("authorization");
  if (process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`) return true;
  const { userId } = await auth();
  if (!userId) return false;
  return (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).includes(userId);
}

// One-time backfill: reclaim refunds for PAST auto-applies the employer later
// confirmed (revenue leak — Skyvern said "failed", we refunded, but the app
// actually landed). Walks every captured "confirmation" email and runs the same
// idempotent reclaim used live by the inbound webhook.
//
//   GET  → dry-run preview (no charges)
//   POST → execute (reclaims for real)
async function run(dryRun: boolean) {
  // Distinct (user, job) pairs that have an employer confirmation on record.
  const { data: rows, error } = await supabaseAdmin
    .from("inbox_messages")
    .select("user_id, job_id")
    .eq("classification", "confirmation")
    .not("job_id", "is", null)
    .limit(20000);
  if (error) return { error: error.message };

  const seen = new Set<string>();
  const pairs = (rows ?? []).filter((r) => {
    const k = `${r.user_id}::${r.job_id}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  let reclaimedCount = 0;
  let reclaimedCredits = 0;
  const users = new Set<string>();
  for (const p of pairs) {
    const amount = await reclaimConfirmedApply(p.user_id as string, p.job_id as string, { dryRun }).catch(() => 0);
    if (amount > 0) { reclaimedCount++; reclaimedCredits += amount; users.add(p.user_id as string); }
  }

  return {
    dryRun,
    confirmations_scanned: pairs.length,
    reclaimed_applies: reclaimedCount,
    reclaimed_credits: reclaimedCredits,
    users_affected: users.size,
  };
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await run(true)); // preview
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await run(false)); // execute
}
