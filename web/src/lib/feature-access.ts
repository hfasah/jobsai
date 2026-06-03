import { getUserPlan } from "@/lib/billing";
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

export async function checkInterviewAccess(
  userId: string,
  mode: InterviewMode
): Promise<AccessResult> {
  const plan = await getUserPlan(userId);
  if (plan !== "free") return { allowed: true };

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
