import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { addTokens } from "@/lib/tokens";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function authorized(req: NextRequest): Promise<boolean> {
  const bearer = req.headers.get("authorization");
  if (process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`) return true;
  const { userId } = await auth();
  if (!userId) return false;
  return (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).includes(userId);
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
async function run(dryRun: boolean) {
  // Failed + unsettled + actually-charged (free applies charged 0 → nothing owed).
  const { data: rows, error } = await supabaseAdmin
    .from("agent_apply_tasks")
    .select("task_id, user_id, job_id, charged_credits")
    .is("metered_credits", null)
    .eq("final_status", "failed")
    .gt("charged_credits", 0)
    .limit(20000);
  if (error) return { error: error.message };

  const tasks = (rows ?? []) as Task[];
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
    refunded_tasks: refundedTasks,
    refunded_credits: refundedCredits,
    users_affected: results.length,
    per_user: results.slice(0, 200),
  };
}

export async function GET(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await run(true));
}

export async function POST(req: NextRequest) {
  if (!(await authorized(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(await run(false));
}
