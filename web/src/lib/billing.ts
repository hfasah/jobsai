import { supabaseAdmin } from "@/lib/supabase";

export type Plan = "free" | "pro" | "premium" | "accelerator";
export type PaidPlan = "pro" | "premium" | "accelerator";
export type BillingInterval = "monthly" | "yearly";

// Per-plan controls. Beyond tokens we gate on:
//   • daily_apply        — max job applications per day (abuse + upgrade pressure)
//   • voice_minutes_month / avatar_minutes_month — caps on the expensive interview
//     tools (also token-metered; this is the hard ceiling)
//   • human_coaching     — whether live human coaching is INCLUDED (it's a paid
//     add-on, never bundled)
export const PLAN_LIMITS = {
  free: {
    max_resumes: 1,
    max_jobs_per_month: 10,
    auto_apply: false,
    daily_apply: 0,
    voice_minutes_month: 0,   // 1 voice + 1 avatar trial handled separately
    avatar_minutes_month: 0,
    human_coaching: false,
    coaching_free_sessions_month: 0, // can still book & pay with tokens
    label: "Free",
  },
  pro: {
    max_resumes: 5,
    max_jobs_per_month: Infinity,
    auto_apply: true,
    daily_apply: 20,
    voice_minutes_month: 30,
    avatar_minutes_month: 0,  // avatar via token top-up only
    human_coaching: true,
    coaching_free_sessions_month: 1, // 1 free 30-min session/mo (advertised "Free coaching")
    label: "Pro",
  },
  premium: {
    max_resumes: 5,
    max_jobs_per_month: Infinity,
    auto_apply: true,
    daily_apply: 100,
    voice_minutes_month: 120,
    avatar_minutes_month: 30,
    human_coaching: true,
    coaching_free_sessions_month: 1, // 1 free 30-min session/mo (advertised "Free coaching")
    label: "Premium",
  },
  accelerator: {
    max_resumes: 5,
    max_jobs_per_month: Infinity,
    auto_apply: true,
    daily_apply: 250,
    voice_minutes_month: 300,
    avatar_minutes_month: 120,
    human_coaching: true,     // 1 free 30-min session/month; extras paid in tokens
    coaching_free_sessions_month: 1,
    label: "Career Accelerator",
  },
} as const;

// Live 1:1 human career coaching.
export const COACHING_SESSION_MINUTES = 30;
export const COACHING_USD = 75; // ≈ 25,000 tokens (TOKEN_COSTS.coaching_session)

// Display prices (monthly anchor + yearly per-month, ~20% off).
export const PLAN_PRICES: Record<PaidPlan, { monthly: number; yearly: number }> = {
  pro:         { monthly: 39,  yearly: 31 },
  premium:     { monthly: 79,  yearly: 63 },
  accelerator: { monthly: 199, yearly: 159 },
};

// Stripe price IDs per plan + interval (set these in env once created in Stripe).
const PRICE_ENV: Record<PaidPlan, { monthly?: string; yearly?: string }> = {
  pro:         { monthly: process.env.STRIPE_PRO_PRICE_ID,         yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID },
  premium:     { monthly: process.env.STRIPE_PREMIUM_PRICE_ID,     yearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID },
  accelerator: { monthly: process.env.STRIPE_ACCELERATOR_PRICE_ID, yearly: process.env.STRIPE_ACCELERATOR_YEARLY_PRICE_ID },
};

export function getPlanPriceId(plan: PaidPlan, interval: BillingInterval): string | undefined {
  const ids = PRICE_ENV[plan];
  return interval === "yearly" ? (ids.yearly ?? ids.monthly) : ids.monthly;
}

// Reverse-lookup for webhooks: which plan does a Stripe price ID belong to?
export function planFromPriceId(priceId: string | undefined): PaidPlan | null {
  if (!priceId) return null;
  for (const plan of ["pro", "premium", "accelerator"] as PaidPlan[]) {
    if (priceId === PRICE_ENV[plan].monthly || priceId === PRICE_ENV[plan].yearly) return plan;
  }
  return null;
}

// One-time token top-up packs → Stripe price IDs. Top-ups are priced at a premium
// per token vs subscriptions (subscribing is the cheaper way to get tokens).
export function getTokenPackPriceId(pack: string): string | undefined {
  const priceIds: Record<string, string | undefined> = {
    pack_small: process.env.STRIPE_PACK_SMALL_PRICE_ID,
    pack_mid:   process.env.STRIPE_PACK_MID_PRICE_ID,
    pack_large: process.env.STRIPE_PACK_LARGE_PRICE_ID,
  };
  return priceIds[pack];
}

export interface BillingRecord {
  user_id: string;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
  current_period_end: string | null;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getUserBilling(userId: string): Promise<BillingRecord> {
  const { data } = await supabaseAdmin
    .from("user_billing")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    return {
      user_id: userId,
      plan: "free",
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_status: "inactive",
      current_period_end: null,
    };
  }

  // Treat canceled/past_due subscriptions as free
  const activePlan =
    data.subscription_status === "active" || data.subscription_status === "trialing"
      ? (data.plan as Plan)
      : "free";

  return { ...data, plan: activePlan };
}

export async function getUserPlan(userId: string): Promise<Plan> {
  const billing = await getUserBilling(userId);
  return billing.plan;
}

// ─── Usage ────────────────────────────────────────────────────────────────────

export async function getMonthlyJobCount(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  return count ?? 0;
}

export async function getResumeCount(userId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from("resume_documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_archived", false);

  return count ?? 0;
}

// ─── Gates ────────────────────────────────────────────────────────────────────

interface GateResult {
  allowed: boolean;
  reason?: string;
  upgrade_required?: boolean;
}

export async function checkResumeGate(userId: string): Promise<GateResult> {
  const plan = await getUserPlan(userId);
  const limit = PLAN_LIMITS[plan]?.max_resumes ?? 1;

  const count = await getResumeCount(userId);
  if (count >= limit) {
    const isPaid = plan !== "free";
    return {
      allowed: false,
      upgrade_required: true,
      reason: isPaid
        ? `You've reached the ${limit} resume limit on your ${plan} plan. Upgrade your plan or top up credits to add more resumes.`
        : `Free plan includes 1 resume. Upgrade to a paid plan for 5 resumes, or top up credits to add more.`,
    };
  }
  return { allowed: true };
}

export async function checkJobImportGate(userId: string): Promise<GateResult> {
  const plan = await getUserPlan(userId);
  if (plan !== "free") return { allowed: true };

  const count = await getMonthlyJobCount(userId);
  if (count >= PLAN_LIMITS.free.max_jobs_per_month) {
    return {
      allowed: false,
      upgrade_required: true,
      reason: `Free plan includes ${PLAN_LIMITS.free.max_jobs_per_month} job imports per month. Upgrade to Pro for unlimited imports.`,
    };
  }
  return { allowed: true };
}

// Applications actually submitted since midnight today (not autofill/needs-review).
export async function getDailyApplyCount(userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count } = await supabaseAdmin
    .from("apply_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "submitted")
    .gte("created_at", startOfDay.toISOString());
  return count ?? 0;
}

export async function checkAutoApplyGate(userId: string): Promise<GateResult> {
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];

  // Access is governed by TOKENS now (each apply costs TOKEN_COSTS.auto_apply),
  // so any plan can auto-apply if they hold the credits. The daily cap is purely
  // abuse protection; plans without a configured cap get a sensible floor.
  const cap = limits.daily_apply && limits.daily_apply > 0 ? limits.daily_apply : 25;
  const used = await getDailyApplyCount(userId);
  if (used >= cap) {
    return {
      allowed: false,
      upgrade_required: plan === "free" || plan === "pro",
      reason: `You've hit today's ${cap} auto-apply limit on ${limits.label}. It resets tomorrow${plan !== "accelerator" ? " — upgrade for a higher daily limit" : ""}.`,
    };
  }
  return { allowed: true };
}
