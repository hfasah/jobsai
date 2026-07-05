import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { addTokens } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Users we NEVER refund here, no matter what the caller passes. Thomas Bianco's
// balance is held at 18,030 by decision (he keeps his grandfathered grant and is
// not refunded his failed-apply charges). Editable exclusions come via ?exclude_emails.
const ALWAYS_EXCLUDE = ["tom.bianco@gmail.com"];

async function authorized(req: NextRequest): Promise<boolean> {
  const bearer = req.headers.get("authorization");
  if (process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`) return true;
  const { userId } = await auth();
  if (!userId) return false;
  return (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).includes(userId);
}

// Resolve a set of email addresses to Clerk user IDs (for exclusion).
async function resolveEmailsToUserIds(emails: string[]): Promise<string[]> {
  const clean = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (clean.length === 0) return [];
  try {
    const client = await clerkClient();
    const res = await client.users.getUserList({ emailAddress: clean, limit: 200 });
    return res.data.map((u) => u.id);
  } catch (err) {
    console.error("[backfill] email resolution failed:", err);
    return [];
  }
}

interface Task { task_id: string; user_id: string; job_id: string; charged_credits: number | null; }
interface UserResult { user_id: string; tasks: number; credits: number }

// One-time (idempotent) remediation for the metering outage: while migration 128
// (agent_apply_tasks.metered_credits) was unapplied, refundFailedAgentApply
// silently no-op'd, so FAILED auto-applies kept their full upfront charge. This
// refunds every unsettled failed apply that submitted nothing (charged_credits
// back to the user), stamping metered_credits=0 as the idempotency claim — the
// exact settlement refundFailedAgentApply would have written. Submitted applies
// are left billed at the flat quote (legitimate). GET = dry-run; POST = execute.
async function run(req: NextRequest, dryRun: boolean) {
  // Exclusion set: always-hold list + any extra ?exclude_emails, resolved to user IDs.
  const extra = (new URL(req.url).searchParams.get("exclude_emails") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const excludeUserIds = new Set(await resolveEmailsToUserIds([...ALWAYS_EXCLUDE, ...extra]));

  // Failed + unsettled + actually-charged (free applies charged 0 → nothing owed).
  const { data: rows, error } = await supabaseAdmin
    .from("agent_apply_tasks")
    .select("task_id, user_id, job_id, charged_credits")
    .is("metered_credits", null)
    .eq("final_status", "failed")
    .gt("charged_credits", 0)
    .limit(20000);
  if (error) return { error: error.message };

  const all = (rows ?? []) as Task[];
  const tasks = all.filter((t) => !excludeUserIds.has(t.user_id));
  const excludedTasks = all.length - tasks.length;
  const perUser = new Map<string, UserResult>();
  let refundedTasks = 0;
  let refundedCredits = 0;

  for (const t of tasks) {
    const amount = t.charged_credits ?? 0;
    if (amount <= 0) continue;

    if (!dryRun) {
      // Claim the settlement atomically (metered_credits: null → 0). If another
      // process already settled it, skip — no double refund.
      const { data: claimed } = await supabaseAdmin
        .from("agent_apply_tasks")
        .update({ metered_credits: 0 })
        .eq("task_id", t.task_id)
        .is("metered_credits", null)
        .select("task_id")
        .maybeSingle();
      if (!claimed) continue;
      await addTokens(t.user_id, amount, "auto_apply_backfill_refund", {
        job_id: t.job_id, task_id: t.task_id, source: "metering_outage_backfill",
      });
    }

    refundedTasks++;
    refundedCredits += amount;
    const u = perUser.get(t.user_id) ?? { user_id: t.user_id, tasks: 0, credits: 0 };
    u.tasks++; u.credits += amount;
    perUser.set(t.user_id, u);
  }

  const results = [...perUser.values()].sort((a, b) => b.credits - a.credits);
  return {
    dryRun,
    failed_unsettled_tasks: tasks.length,
    excluded_tasks: excludedTasks,
    grandfathered: excludeUserIds.size,
    refunded_tasks: refundedTasks,
    refunded_credits: refundedCredits,
    users_affected: results.length,
    per_user: results.slice(0, 200),
  };
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await run(req, true));
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await run(req, false));
}
