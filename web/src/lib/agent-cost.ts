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
import { addTokens, deductTokens } from "@/lib/tokens";

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

// ─── User billing metered against real usage (OUR credits) ─────────────────────
// We bill the user in OUR credit units (not Skyvern credits), markup baked in.
// A typical ~6-step apply ≈ 600 (matches the flat TOKEN_COSTS.auto_apply quote);
// lighter applies cost less (refunded), heavier ones more (overage), clamped so a
// single run can neither be free nor bankrupt the user.
export const BILLED_CREDITS_PER_STEP = 100; // 6 steps → 600 (≈ current flat)
export const METER_MIN_CREDITS = 200;
export const METER_MAX_CREDITS = 1200;
// Whether to bill steps ABOVE the flat quote so heavy users fund themselves.
// Off → refund-only (never charge more than quoted). On → full pass-through.
export const METER_CHARGE_OVERAGE = true;

export function meteredCreditsForSteps(stepCount: number | null | undefined): number {
  const steps = Math.max(0, Math.round(stepCount ?? 0));
  const raw = steps === 0 ? METER_MIN_CREDITS : steps * BILLED_CREDITS_PER_STEP;
  return Math.min(METER_MAX_CREDITS, Math.max(METER_MIN_CREDITS, raw));
}

export interface MeterResult { metered: number; delta: number; applied: boolean }

/**
 * Reconcile the flat upfront charge against the run's real step_count.
 * Idempotent: the first call to set agent_apply_tasks.metered_credits wins, so
 * webhook retries never double-bill. Returns the settlement (or null if there's
 * no usage data / it was already settled / pre-migration).
 */
export async function settleAgentApply(opts: {
  taskId: string;
  userId: string;
  jobId: string;
  stepCount: number | null | undefined;
  chargedUpfront: number;
}): Promise<MeterResult | null> {
  const { taskId, userId, jobId, stepCount, chargedUpfront } = opts;
  if (stepCount == null) return null; // no usage signal → leave the flat charge

  const metered = meteredCreditsForSteps(stepCount);

  // Claim the settlement: set metered_credits only if still null. If no row
  // comes back, another webhook delivery already settled it (or column missing).
  const { data: claimed, error } = await supabaseAdmin
    .from("agent_apply_tasks")
    .update({ metered_credits: metered })
    .eq("task_id", taskId)
    .is("metered_credits", null)
    .select("task_id")
    .maybeSingle();
  if (error) {
    console.warn("[meter] settle guard failed (run migration 128?):", error.message);
    return null;
  }
  if (!claimed) return null; // already settled

  // Free applies (charged 0) are never billed post-hoc.
  if (chargedUpfront <= 0) return { metered, delta: 0, applied: false };

  const delta = metered - chargedUpfront;
  if (delta === 0) return { metered, delta: 0, applied: false };

  if (delta < 0) {
    await addTokens(userId, -delta, "auto_apply_meter_refund", { job_id: jobId, steps: Math.round(stepCount), metered });
    return { metered, delta, applied: true };
  }
  if (METER_CHARGE_OVERAGE) {
    const r = await deductTokens(userId, delta, "auto_apply_meter_overage", { job_id: jobId, steps: Math.round(stepCount), metered });
    // Apply already happened — if they can't cover the overage, absorb it.
    if (!r.ok) console.warn(`[meter] overage ${delta} uncovered for ${userId}; absorbed.`);
    return { metered, delta, applied: r.ok };
  }
  return { metered, delta: 0, applied: false };
}

/**
 * Fully refund a FAILED auto-apply — the user got no application, so they
 * shouldn't pay (we eat the Skyvern cost; that's the incentive to improve agent
 * success). Idempotent via the same metered_credits claim (set to 0 = "refunded,
 * no charge"). Used only for runs that did NOT submit.
 */
export async function refundFailedAgentApply(opts: {
  taskId: string;
  userId: string;
  jobId: string;
  chargedUpfront: number;
}): Promise<MeterResult | null> {
  const { taskId, userId, jobId, chargedUpfront } = opts;

  const { data: claimed, error } = await supabaseAdmin
    .from("agent_apply_tasks")
    .update({ metered_credits: 0 })
    .eq("task_id", taskId)
    .is("metered_credits", null)
    .select("task_id")
    .maybeSingle();
  if (error) {
    console.warn("[meter] refund guard failed (run migration 128?):", error.message);
    return null;
  }
  if (!claimed) return null;            // already settled/refunded
  if (chargedUpfront <= 0) return { metered: 0, delta: 0, applied: false }; // free apply

  await addTokens(userId, chargedUpfront, "auto_apply_failed_refund", { job_id: jobId });
  return { metered: 0, delta: -chargedUpfront, applied: true };
}

/**
 * Revenue-leak fix: reclaim a refund that was given because Skyvern reported an
 * auto-apply as "failed" — when the EMPLOYER later confirms the application was
 * actually received. We treat the employer confirmation as ground truth and
 * reverse the erroneous `auto_apply_failed_refund`, so a successful application
 * isn't billed as free. Precise + idempotent: only acts when a failed-refund
 * exists for the job and hasn't already been reclaimed. Best-effort — if the
 * user has since spent the credits below the reclaim amount, we skip.
 */
export async function reclaimConfirmedApply(userId: string, jobId: string): Promise<number> {
  if (!userId || !jobId) return 0;

  // Already reclaimed for this job? (idempotency — a job may get several
  // confirmation emails.)
  const { data: already } = await supabaseAdmin
    .from("token_ledger").select("id")
    .eq("user_id", userId).eq("reason", "auto_apply_confirmed_recharge")
    .filter("metadata->>job_id", "eq", jobId).limit(1).maybeSingle();
  if (already) return 0;

  // Find the erroneous full refund (auto-apply marked failed) for this job.
  const { data: refund } = await supabaseAdmin
    .from("token_ledger").select("delta")
    .eq("user_id", userId).eq("reason", "auto_apply_failed_refund")
    .filter("metadata->>job_id", "eq", jobId)
    .gt("delta", 0)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!refund) return 0; // nothing was refunded for this job → nothing to reclaim

  const amount = Math.abs(Number(refund.delta));
  if (!amount) return 0;

  const r = await deductTokens(userId, amount, "auto_apply_confirmed_recharge", { job_id: jobId, source: "employer_confirmation" });
  return r.ok ? amount : 0;
}
