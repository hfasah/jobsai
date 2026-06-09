// Estimate the Skyvern cost of a browser-agent run and record it on the
// apply_attempts row, so we build a live per-run / per-user cost dataset.
//
// Calibrated from the live Skyvern dashboard (2026-06-09): billing is per
// ACTION, not per step. A real 6-step apply billed ~27 actions / ~810 credits.
//   - 1 step  ≈ ~4.5 billable actions
//   - 1 action = 30 credits (regular)  [cached actions are 15, uptime 200/hr]
//   - 1 credit ≈ $0.001 on paid plans (Pro $149/150k, Hobby $29/30k)
// step_count is the only per-run number the API exposes, so credits/USD here
// are ESTIMATES; the Skyvern dashboard remains the source of truth for billing.

import { supabaseAdmin } from "@/lib/supabase";

export const ACTIONS_PER_STEP = 4.5;
export const CREDITS_PER_ACTION = 30;
export const USD_PER_CREDIT = 0.001;

export interface AgentCost {
  steps: number;
  actions: number;
  credits: number;
  usd: number;
}

export function estimateAgentCost(stepCount: number | null | undefined): AgentCost {
  const steps = Math.max(0, Math.round(stepCount ?? 0));
  const actions = Math.round(steps * ACTIONS_PER_STEP);
  const credits = actions * CREDITS_PER_ACTION;
  const usd = Math.round(credits * USD_PER_CREDIT * 10000) / 10000;
  return { steps, actions, credits, usd };
}

/**
 * Record estimated cost on the user's agent apply attempt. Best-effort and
 * isolated from the status update — if the 051 migration hasn't run yet, this
 * logs and returns without affecting anything else.
 */
export async function recordAgentCost(
  userId: string,
  jobId: string,
  stepCount: number | null | undefined
): Promise<void> {
  if (stepCount == null) return;
  const c = estimateAgentCost(stepCount);
  const { error } = await supabaseAdmin
    .from("apply_attempts")
    .update({
      agent_steps: c.steps,
      agent_actions: c.actions,
      agent_credits: c.credits,
      agent_cost_usd: c.usd,
    })
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .eq("platform", "agent");
  if (error) console.warn("[agent-cost] record failed (run migration 051?):", error.message);
}
