import { NextRequest, NextResponse } from "next/server";
import { finalizeAgentRun } from "@/lib/agent-finalize";

// POST /api/webhooks/agent-apply — Skyvern callback when an agent run finishes.
// All settlement (status, cost, metering, profile, notification, application
// advance) lives in finalizeAgentRun, shared with the status-poll reconciler so
// a run still settles if this webhook is never delivered. Idempotent.
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // New Run Tasks API sends run_id; older payloads used task_id. Both map to
  // agent_apply_tasks.task_id.
  const taskId = (body.run_id ?? body.task_id) as string | undefined;
  const status = body.status as string | undefined;
  if (!taskId) return NextResponse.json({ error: "Missing run_id" }, { status: 400 });

  const stepCount = typeof body.step_count === "number" ? (body.step_count as number) : undefined;
  await finalizeAgentRun(taskId, status, stepCount).catch((e) =>
    console.error("[webhook/agent-apply] finalize failed:", e),
  );

  return NextResponse.json({ ok: true });
}
