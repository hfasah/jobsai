// Reconcile in-flight browser-agent applications against Skyvern.
//
// The Skyvern webhook is best-effort; this is the reliable backstop. We poll
// each unresolved agent_apply_tasks row by its run id (which is GET-able) and
// settle it: confirm "applied" on success, or revert to "saved" with the real
// reason on failure (geo-block, login wall, etc.) so the user is never left
// with a card that silently dropped or a false success.

import { supabaseAdmin } from "@/lib/supabase";
import { getSkyvernTask, isTerminalStatus } from "@/lib/skyvern";
import { createNotification } from "@/lib/notifications";
import { recordAgentCost } from "@/lib/agent-cost";

// Turn a raw Skyvern failure_reason into something a candidate can trust.
export function humanizeAgentFailure(reason?: string | null): string {
  const r = (reason ?? "").toLowerCase();
  if (/not available in your region|region|geo/.test(r))
    return "This job isn't available in your region — the employer restricted applications to other locations.";
  if (/login|sign in|account|credentials|password/.test(r))
    return "This site required a login the agent couldn't complete. Add a Job Board Account Password in your Apply Profile and try again.";
  if (/captcha|verification|verify/.test(r))
    return "The site asked for a verification step the agent couldn't pass.";
  if (/expired|no longer|closed|not found/.test(r))
    return "The employer is no longer accepting applications for this posting.";
  return reason
    ? `The agent couldn't complete this application: ${reason}`
    : "The agent couldn't complete this application.";
}

async function jobLabel(jobId: string): Promise<{ title: string; company: string }> {
  const { data } = await supabaseAdmin
    .from("job_parsed")
    .select("title, company")
    .eq("job_id", jobId)
    .maybeSingle();
  return { title: data?.title ?? "a role", company: data?.company ?? "a company" };
}

interface TaskRow {
  task_id: string;
  user_id: string;
  job_id: string;
}

/** Resolve a single agent task. Returns true if it reached a terminal state. */
export async function resolveAgentTask(task: TaskRow): Promise<boolean> {
  let run;
  try {
    run = await getSkyvernTask(task.task_id);
  } catch {
    return false; // transient — leave it for next time
  }
  if (!isTerminalStatus(run.status)) return false;

  const success = run.status === "completed";
  const now = new Date().toISOString();

  // Settle the apply attempt (pending agent run → submitted/failed)
  await supabaseAdmin
    .from("apply_attempts")
    .update({
      status: success ? "submitted" : "failed",
      submitted_at: success ? now : null,
      error_msg: success
        ? `Agent completed (${run.step_count ?? "?"} steps)`
        : `${run.status}: ${run.failure_reason ?? "no reason"} (${run.step_count ?? "?"} steps)`,
    })
    .eq("user_id", task.user_id)
    .eq("job_id", task.job_id)
    .eq("platform", "agent")
    .eq("status", "pending");

  // Record estimated Skyvern cost (separate write — never blocks settlement).
  await recordAgentCost(task.user_id, task.job_id, run.step_count);

  const { title, company } = await jobLabel(task.job_id);

  if (success) {
    // Confirm the card as applied (it was set optimistically at launch).
    await supabaseAdmin
      .from("applications")
      .update({ stage: "applied", applied_at: now })
      .eq("user_id", task.user_id)
      .eq("job_id", task.job_id)
      .eq("stage", "saved");
    createNotification(
      task.user_id, "agent_apply_done", "Application submitted ✓",
      `The browser agent successfully applied to ${title} at ${company}.`,
      { job_id: task.job_id }
    ).catch(() => {});
  } else {
    // Honest revert: only pull back a card still sitting at "applied" (don't
    // touch one the user manually advanced to interviewing/offer/rejected).
    const { data: app } = await supabaseAdmin
      .from("applications")
      .select("id, stage, stage_history")
      .eq("user_id", task.user_id)
      .eq("job_id", task.job_id)
      .maybeSingle();
    if (app && app.stage === "applied") {
      const history = Array.isArray(app.stage_history) ? app.stage_history : [];
      await supabaseAdmin
        .from("applications")
        .update({ stage: "saved", applied_at: null, stage_history: [...history, { stage: "saved", at: now }] })
        .eq("id", app.id);
    }
    createNotification(
      task.user_id, "agent_apply_failed", "Couldn't complete this application",
      `${title} at ${company}: ${humanizeAgentFailure(run.failure_reason)}`,
      { job_id: task.job_id }
    ).catch(() => {});
  }

  await supabaseAdmin
    .from("agent_apply_tasks")
    .update({ resolved_at: now, final_status: success ? "submitted" : "failed" })
    .eq("task_id", task.task_id);

  return true;
}

/**
 * Resolve a user's unresolved agent tasks. Safe to call on dashboard loads;
 * capped and time-gated so it stays cheap.
 */
export async function resolvePendingAgentTasks(userId: string): Promise<number> {
  const { data: tasks } = await supabaseAdmin
    .from("agent_apply_tasks")
    .select("task_id, user_id, job_id")
    .eq("user_id", userId)
    .is("resolved_at", null)
    .order("created_at", { ascending: true })
    .limit(10);
  if (!tasks?.length) return 0;

  let resolved = 0;
  await Promise.all(
    tasks.map(async (t) => {
      try {
        if (await resolveAgentTask(t as TaskRow)) resolved++;
      } catch {
        /* leave for next load */
      }
    })
  );
  return resolved;
}
