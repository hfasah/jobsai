import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { getSkyvernTask } from "@/lib/skyvern";
import { recordAgentCost } from "@/lib/agent-cost";
import { addTokens } from "@/lib/tokens";

// Refund the auto-apply charge when a run FAILS after launching (Skyvern
// couldn't submit — login wall, CAPTCHA, timeout, etc.). Previously only
// launch-creation failures refunded, so users lost 600 tokens on failed runs.
// Idempotent: only refunds a paid charge for this job that hasn't been refunded.
async function refundFailedApply(userId: string, jobId: string): Promise<number> {
  // Already refunded? (guards webhook retries)
  const { data: existing } = await supabaseAdmin
    .from("token_ledger").select("id")
    .eq("user_id", userId).eq("reason", "auto_apply_refund")
    .filter("metadata->>job_id", "eq", jobId).limit(1).maybeSingle();
  if (existing) return 0;

  // Find the paid charge for this job (free-apply attempts carry no job_id and
  // no paid deduction, so there's nothing to refund for those).
  const { data: charge } = await supabaseAdmin
    .from("token_ledger").select("delta")
    .eq("user_id", userId).eq("reason", "auto_apply")
    .filter("metadata->>job_id", "eq", jobId)
    .lt("delta", 0)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!charge) return 0;

  const amount = Math.abs(Number(charge.delta));
  if (!amount) return 0;
  await addTokens(userId, amount, "auto_apply_refund", { job_id: jobId, source: "post_launch_failure" });
  return amount;
}

// POST /api/webhooks/agent-apply — Skyvern callback when agent completes/fails
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // New Run Tasks API sends run_id; older payloads used task_id. We store run_id
  // in agent_apply_tasks.task_id, so either field resolves the same record.
  const taskId = (body.run_id ?? body.task_id) as string | undefined;
  const status = body.status as string | undefined;

  if (!taskId) return NextResponse.json({ error: "Missing run_id" }, { status: 400 });

  // Look up our record for this task
  const { data: task } = await supabaseAdmin
    .from("agent_apply_tasks")
    .select("user_id, job_id")
    .eq("task_id", taskId)
    .maybeSingle();

  if (!task) {
    console.warn("[webhook/agent-apply] Unknown task_id:", taskId);
    return NextResponse.json({ ok: true }); // Acknowledge but ignore unknown tasks
  }

  const { user_id: userId, job_id: jobId } = task;

  // Map Skyvern run status to our status (must be an allowed apply_attempts
  // value: pending|submitted|failed|manual_required).
  const success = status === "completed";
  const failed =
    status === "failed" ||
    status === "terminated" ||
    status === "timed_out" ||
    status === "canceled";
  const ourStatus = success ? "submitted" : failed ? "failed" : "pending";

  // Update the in-flight agent attempt (recorded as platform=agent, status=pending).
  // .select() tells us whether THIS call transitioned it (pending→…), so a
  // webhook retry that matches 0 rows won't trigger a second refund.
  const { data: transitioned } = await supabaseAdmin
    .from("apply_attempts")
    .update({
      status: ourStatus,
      submitted_at: success ? new Date().toISOString() : null,
      error_msg: failed ? `Agent status: ${status}` : undefined,
    })
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .eq("platform", "agent")
    .eq("status", "pending")
    .select("id");
  const firstTransition = (transitioned ?? []).length > 0;

  // Record estimated Skyvern cost. Prefer step_count from the payload; fetch
  // the run only if it's missing. Separate write — never blocks settlement.
  if (success || failed) {
    let stepCount = typeof body.step_count === "number" ? (body.step_count as number) : null;
    if (stepCount == null) {
      stepCount = await getSkyvernTask(taskId).then((r) => r.step_count ?? null).catch(() => null);
    }
    await recordAgentCost(userId, jobId, stepCount);
  }

  if (success || failed) {
    // Get job info for notification — title/company live on job_parsed, not jobs
    const { data: job } = await supabaseAdmin
      .from("job_parsed")
      .select("title, company")
      .eq("job_id", jobId)
      .maybeSingle();

    const title = job?.title ?? "a role";
    const company = job?.company ?? "a company";

    if (success) {
      // Move to applied in application tracker
      await supabaseAdmin
        .from("applications")
        .upsert({
          user_id: userId,
          job_id: jobId,
          stage: "applied",
          applied_at: new Date().toISOString(),
          stage_history: [{ stage: "applied", at: new Date().toISOString() }],
        })
        .match({ user_id: userId, job_id: jobId });

      createNotification(
        userId,
        "agent_apply_done",
        "Application submitted ✓",
        `Browser agent successfully applied to ${title} at ${company}.`,
        { job_id: jobId }
      ).catch(console.error);
    } else {
      // Refund the charge for a run that failed after launching (only on the
      // first transition, so retries don't double-refund).
      const refunded = firstTransition ? await refundFailedApply(userId, jobId).catch(() => 0) : 0;
      const refundLine = refunded > 0
        ? ` We've refunded the ${refunded.toLocaleString()} credits for this attempt.`
        : "";
      createNotification(
        userId,
        "agent_apply_failed",
        "Agent apply couldn't complete",
        `The agent couldn't fully submit your application to ${title} at ${company}.${refundLine} Your tailored résumé and cover letter are still saved — you can apply manually.`,
        { job_id: jobId, refunded }
      ).catch(console.error);
    }

    // Mark task as resolved
    await supabaseAdmin
      .from("agent_apply_tasks")
      .update({ resolved_at: new Date().toISOString(), final_status: ourStatus })
      .eq("task_id", taskId);
  }

  return NextResponse.json({ ok: true });
}
