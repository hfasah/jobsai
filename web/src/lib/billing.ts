import { supabaseAdmin } from "@/lib/supabase";

export type Plan = "free" | "pro" | "premium" | "accelerator";
export type PaidPlan = "pro" | "premium" | "accelerator";
export type BillingInterval = "monthly" | "yearly";

export const PLAN_LIMITS = {
  free: {
    max_resumes: 1,
    max_jobs_per_month: 10,
    auto_apply: false,
    label: "Free",
  },
  pro: {
    max_resumes: Infinity,
    max_jobs_per_month: Infinity,
    auto_apply: true,
    label: "Pro",
  },
  premium: {
    max_resumes: Infinity,
    max_jobs_per_month: Infinity,
    auto_apply: true,
    label: "Premium",
  },
  accelerator: {
    max_resumes: Infinity,
    max_jobs_per_month: Infinity,
    auto_apply: true,
    label: "Career Accelerator",
  },
} as const;

// Display prices (monthly anchor + yearly per-month, ~20% off).
export const PLAN_PRICES: Record<PaidPlan, { monthly: number; yearly: number }> = {
  pro:         { monthly: 29,  yearly: 23 },
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

// One-time token top-up packs → Stripe price IDs.
export const TOKEN_PACK_PRICE_IDS: Record<string, string | undefined> = {
  pack_5k:  process.env.STRIPE_PACK_5K_PRICE_ID,
  pack_20k: process.env.STRIPE_PACK_20K_PRICE_ID,
  pack_60k: process.env.STRIPE_PACK_60K_PRICE_ID,
};

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
  if (plan !== "free") return { allowed: true };

  const count = await getResumeCount(userId);
  if (count >= PLAN_LIMITS.free.max_resumes) {
    return {
      allowed: false,
      upgrade_required: true,
      reason: `Free plan includes ${PLAN_LIMITS.free.max_resumes} resume. Upgrade to Pro for unlimited resumes.`,
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

export async function checkAutoApplyGate(userId: string): Promise<GateResult> {
  const plan = await getUserPlan(userId);
  if (PLAN_LIMITS[plan].auto_apply) return { allowed: true };
  return {
    allowed: false,
    upgrade_required: true,
    reason: "Auto-apply is a Pro feature. Upgrade to enable automatic job applications.",
  };
}
