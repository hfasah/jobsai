import { getUserPlan, PLAN_LIMITS } from "@/lib/billing";
import { supabaseAdmin } from "@/lib/supabase";

// Gates the realism tiers (voice now, avatar in Phase 38). Free users get a
// limited lifetime trial of each mode; paid plans are unlimited subject to
// their token balance. Per the locked pricing model, voice is included on all
// paid plans (metered from tokens); avatar is Premium+.

export type InterviewMode = "voice" | "avatar";

const FREE_TRIAL_LIMIT: Record<InterviewMode, number> = {
  voice: 1,
  avatar: 1,
};

export interface AccessResult {
  allowed: boolean;
  reason?: string;
  upgrade_required?: boolean;
  trial?: boolean; // true when this is the free user's trial run
}

// Minutes (≈ metered turns) used for a mode this calendar month, from the ledger.
async function minutesThisMonth(userId: string, mode: InterviewMode): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const feature = mode === "voice" ? "voice_minute" : "avatar_minute";
  const { count } = await supabaseAdmin
    .from("token_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", feature)
    .lt("delta", 0)
    .gte("created_at", startOfMonth.toISOString());
  return count ?? 0;
}

export async function checkInterviewAccess(
  userId: string,
  mode: InterviewMode
): Promise<AccessResult> {
  const plan = await getUserPlan(userId);

  if (plan !== "free") {
    // Per-plan monthly minute ceiling on the expensive interview tools. A cap of 0
    // means "no monthly inclusion — gated by token balance only" (e.g. Pro avatar
    // via top-up); a positive cap is a hard ceiling that protects margins.
    const cap = mode === "voice"
      ? PLAN_LIMITS[plan].voice_minutes_month
      : PLAN_LIMITS[plan].avatar_minutes_month;
    if (cap > 0) {
      const used = await minutesThisMonth(userId, mode);
      if (used >= cap) {
        return {
          allowed: false,
          upgrade_required: true,
          reason: `You've used your ${cap} ${mode} minutes this month on ${PLAN_LIMITS[plan].label}. Upgrade for more — it resets next month.`,
        };
      }
    }
    return { allowed: true };
  }

  // Free plan → count completed sessions of this mode against the trial limit.
  const { count } = await supabaseAdmin
    .from("interview_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("mode", mode);

  const used = count ?? 0;
  if (used >= FREE_TRIAL_LIMIT[mode]) {
    return {
      allowed: false,
      upgrade_required: true,
      reason: `You've used your free ${mode} interview trial. Upgrade to keep practicing with ${mode} interviews.`,
    };
  }
  return { allowed: true, trial: true };
}
