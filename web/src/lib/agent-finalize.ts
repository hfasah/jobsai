import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { getSkyvernTask, createBrowserProfile } from "@/lib/skyvern";
import { recordAgentCost, settleAgentApply } from "@/lib/agent-cost";

// Settle a finished browser-agent run: update the attempt, record cost, meter the
// user's credits, capture the board profile, notify, advance the application.
//
// Called by BOTH the Skyvern completion webhook AND the status-poll reconciler
// (which polls Skyvern directly when an attempt is stuck "pending" — so a run
// resolves even if the webhook is never delivered). Idempotent: the first caller
// to claim agent_apply_tasks.resolved_at does the side effects; the rest no-op.

function mapStatus(s: string | undefined): "submitted" | "failed" | "pending" {
  if (s === "completed") return "submitted";
  if (s === "failed" || s === "terminated" || s === "timed_out" || s === "canceled") return "failed";
  return "pending";
}

export interface FinalizeResult {
  resolved: boolean;
  status: "submitted" | "failed" | "pending";
}

export async function finalizeAgentRun(
  taskId: string,
  skyvernStatus: string | undefined,
  stepCountHint?: number | null,
): Promise<FinalizeResult> {
  const ourStatus = mapStatus(skyvernStatus);
  if (ourStatus === "pending") return { resolved: false, status: "pending" };

  const { data: task } = await supabaseAdmin
    .from("agent_apply_tasks")
    .select("user_id, job_id, charged_credits, board, run_mode")
    .eq("task_id", taskId)
    .maybeSingle();
  if (!task) return { resolved: false, status: "pending" };

  // Idempotency claim — only the first finalize runs the side effects.
  const { data: claimed } = await supabaseAdmin
    .from("agent_apply_tasks")
    .update({ resolved_at: new Date().toISOString(), final_status: ourStatus })
    .eq("task_id", taskId)
    .is("resolved_at", null)
    .select("task_id")
    .maybeSingle();
  if (!claimed) return { resolved: true, status: ourStatus }; // already settled

  const { user_id: userId, job_id: jobId } = task;
  const success = ourStatus === "submitted";

  await supabaseAdmin
    .from("apply_attempts")
    .update({
      status: ourStatus,
      submitted_at: success ? new Date().toISOString() : null,
      error_msg: success ? undefined : `Agent status: ${skyvernStatus}`,
    })
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .eq("platform", "agent")
    .eq("status", "pending");

  // Cost + metering (fetch step_count if the caller didn't have it).
  let stepCount = typeof stepCountHint === "number" ? stepCountHint : null;
  if (stepCount == null) {
    stepCount = await getSkyvernTask(taskId).then((r) => r.step_count ?? null).catch(() => null);
  }
  await recordAgentCost(userId, jobId, stepCount);
  const meter = await settleAgentApply({
    taskId,
    userId,
    jobId,
    stepCount,
    chargedUpfront: typeof task.charged_credits === "number" ? task.charged_credits : 0,
  }).catch((e) => { console.error("[finalize] settle failed:", e); return null; });

  const meterNote = meter && meter.applied
    ? meter.delta < 0
      ? ` ${-meter.delta} credits refunded (used ${meter.metered}).`
      : ` ${meter.delta} extra credits used (total ${meter.metered}).`
    : "";

  const { data: job } = await supabaseAdmin
    .from("job_parsed")
    .select("title, company")
    .eq("job_id", jobId)
    .maybeSingle();
  const title = job?.title ?? "a role";
  const company = job?.company ?? "a company";

  if (success) {
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

    // Cost lever #2: snapshot/refresh the board login profile from this run.
    if (task.run_mode === "workflow" && task.board) {
      const profileId = await createBrowserProfile(taskId).catch(() => null);
      if (profileId) {
        await supabaseAdmin
          .from("agent_board_profiles")
          .upsert(
            {
              user_id: userId,
              board: task.board,
              browser_profile_id: profileId,
              workflow_run_id: taskId,
              refreshed_at: new Date().toISOString(),
            },
            { onConflict: "user_id,board" },
          )
          .then(({ error }) => { if (error) console.warn("[finalize] profile upsert failed:", error.message); });
      }
    }

    createNotification(
      userId,
      "agent_apply_done",
      "Application submitted ✓",
      `Browser agent successfully applied to ${title} at ${company}.${meterNote}`,
      { job_id: jobId },
    ).catch(console.error);
  } else {
    createNotification(
      userId,
      "agent_apply_failed",
      "Agent apply couldn't complete",
      `The agent couldn't fully submit your application to ${title} at ${company}. Your tailored résumé and cover letter are still saved — you can apply manually.${meterNote}`,
      { job_id: jobId },
    ).catch(console.error);
  }

  return { resolved: true, status: ourStatus };
}
