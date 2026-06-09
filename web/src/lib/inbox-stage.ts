// Advance an application's pipeline stage based on a classified employer reply.
// Forward-only: an automated email never drags a card backwards, and an offer
// always outranks a stray rejection auto-responder.

import { supabaseAdmin } from "@/lib/supabase";
import type { ApplicationStage } from "@/types/application";
import type { InboxClass } from "@/lib/inbox";

const RANK: Record<ApplicationStage, number> = {
  saved: 0,
  applied: 1,
  interviewing: 2,
  offer: 3,
  rejected: 1, // terminal, but ranked low so "offer" can't be overwritten by it
};

// Which stage a given email class implies. null = no stage change.
function targetStage(cls: InboxClass): ApplicationStage | null {
  switch (cls) {
    case "interview":
      return "interviewing";
    case "rejection":
      return "rejected";
    case "confirmation":
      return "applied";
    default:
      return null; // otp / update / other
  }
}

/**
 * Move the (user, job) application card to reflect an inbound reply.
 * Returns the new stage if it changed, otherwise null.
 */
export async function advanceStageFromClass(
  userId: string,
  jobId: string,
  cls: InboxClass
): Promise<ApplicationStage | null> {
  const target = targetStage(cls);
  if (!target) return null;

  const now = new Date().toISOString();

  const { data: app } = await supabaseAdmin
    .from("applications")
    .select("id, stage, stage_history, applied_at")
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .maybeSingle();

  // No card yet (e.g. reply arrived before tracking) — create one at the target.
  if (!app) {
    await supabaseAdmin.from("applications").upsert(
      {
        user_id: userId,
        job_id: jobId,
        stage: target,
        applied_at: target === "applied" || target === "interviewing" ? now : null,
        stage_history: [{ stage: target, at: now }],
      },
      { onConflict: "user_id,job_id" }
    );
    return target;
  }

  const current = app.stage as ApplicationStage;
  if (current === target) return null;

  // Never let an offer be overwritten by an automated reply.
  if (current === "offer") return null;
  // A rejection is terminal for automation; don't auto-resurrect it.
  if (current === "rejected") return null;
  // Forward-only: confirmation must not pull "interviewing" back to "applied".
  if (RANK[target] <= RANK[current] && target !== "rejected") return null;

  const history = Array.isArray(app.stage_history) ? app.stage_history : [];
  await supabaseAdmin
    .from("applications")
    .update({
      stage: target,
      applied_at: app.applied_at ?? (target === "interviewing" ? now : null),
      stage_history: [...history, { stage: target, at: now }],
    })
    .eq("id", app.id);

  return target;
}
