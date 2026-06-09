import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createNotification } from "@/lib/notifications";
import { getSkyvernTask } from "@/lib/skyvern";
import { recordAgentCost } from "@/lib/agent-cost";

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

  // Update the in-flight agent attempt (recorded as platform=agent, status=pending)
  await supabaseAdmin
    .from("apply_attempts")
    .update({
      status: ourStatus,
      submitted_at: success ? new Date().toISOString() : null,
      error_msg: failed ? `Agent status: ${status}` : undefined,
    })
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .eq("platform", "agent")
    .eq("status", "pending");

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
      createNotification(
        userId,
        "agent_apply_failed",
        "Agent apply couldn't complete",
        `The agent couldn't fully submit your application to ${title} at ${company}. Your tailored résumé and cover letter are still saved — you can apply manually.`,
        { job_id: jobId }
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
