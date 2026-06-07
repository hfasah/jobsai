import { supabaseAdmin } from "@/lib/supabase";
import { getUserPlan, type Plan } from "@/lib/billing";

// ─── Economics ──────────────────────────────────────────────────────────────
// Token costs are tuned so the price a user pays always exceeds the underlying
// API cost (see project pricing model). Cheap features feel ~unlimited on paid
// plans; voice/avatar are metered per-minute.

export const TOKEN_COSTS = {
  written_eval: 50,    // one written-coach answer evaluation (~$0.10 API)
  resume_tailor: 30,
  cover_letter: 30,
  ats_scan: 20,
  linkedin_optimize: 30, // full LinkedIn profile rewrite + audit
  linkedin_post: 20,     // one generated LinkedIn writeup
  voice_minute: 60,    // ~600 for a 10-min voice interview
  avatar_minute: 250,  // ~2,500 for a 10-min avatar interview
} as const;

export type TokenFeature = keyof typeof TOKEN_COSTS;

// Monthly allowance per plan. Free is a one-time grant; paid plans re-grant each
// month. Phase 39 extends this map to premium / accelerator tiers.
export const PLAN_TOKEN_GRANTS: Record<Plan, { amount: number; recurring: boolean }> = {
  free:        { amount: 500,    recurring: false },
  pro:         { amount: 5_000,  recurring: true },
  premium:     { amount: 20_000, recurring: true },
  accelerator: { amount: 60_000, recurring: true },
};

// Top-up packs (wired to Stripe in Phase 39).
// Top-ups are a PREMIUM, à-la-carte convenience: priced higher per token than the
// per-token value bundled in a subscription, so subscribing is always the better
// deal. Minimum top-up is $10. Prices are display only — the actual charge comes
// from the matching Stripe price IDs (TOKEN_PACK_PRICE_IDS), kept in sync.
//   pack_small  3,000 / $10  = $0.0033/token
//   pack_mid   10,000 / $30  = $0.0030/token
//   pack_large 25,000 / $69  = $0.0028/token
export const TOKEN_PACKS = [
  { id: "pack_small", tokens: 3_000,  price: "$10" },
  { id: "pack_mid",   tokens: 10_000, price: "$30" },
  { id: "pack_large", tokens: 25_000, price: "$69" },
] as const;

export interface TokenAccount {
  balance: number;
  monthly_grant: number;
  plan: Plan;
  last_granted_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sameMonth(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

async function writeLedger(
  userId: string,
  delta: number,
  balanceAfter: number,
  reason: string,
  feature: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabaseAdmin.from("token_ledger").insert({
      user_id: userId,
      delta,
      balance_after: balanceAfter,
      reason,
      feature,
      metadata,
    });
  } catch (err) {
    console.error("token_ledger insert failed:", err);
  }
}

// ─── Account read + grant reconciliation ───────────────────────────────────────
// Lazily creates the account, applies the signup grant, refreshes on plan change,
// and credits the monthly allowance once per calendar month for recurring plans.

export async function getTokenAccount(userId: string): Promise<TokenAccount> {
  const plan = await getUserPlan(userId);
  const grant = PLAN_TOKEN_GRANTS[plan];

  const { data: existing } = await supabaseAdmin
    .from("user_tokens")
    .select("balance, monthly_grant, plan, last_granted_at")
    .eq("user_id", userId)
    .maybeSingle();

  // First touch → create with the initial grant.
  if (!existing) {
    const row = {
      user_id: userId,
      balance: grant.amount,
      monthly_grant: grant.amount,
      plan,
      last_granted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await supabaseAdmin.from("user_tokens").insert(row);
    await writeLedger(userId, grant.amount, grant.amount, "signup_grant", null, { plan });
    return { balance: grant.amount, monthly_grant: grant.amount, plan, last_granted_at: row.last_granted_at };
  }

  let balance = existing.balance as number;
  const lastGranted = new Date(existing.last_granted_at as string);
  const now = new Date();
  const planChanged = existing.plan !== plan;

  // Credit the monthly allowance for recurring plans once per month.
  const needsMonthly = grant.recurring && !sameMonth(lastGranted, now);
  // On a plan change into a recurring plan, grant immediately (they just paid).
  // Fires once — the grant updates the stored plan, so the next read won't repeat.
  const needsUpgradeGrant = planChanged && grant.recurring;

  if (needsMonthly || needsUpgradeGrant) {
    balance += grant.amount;
    await supabaseAdmin
      .from("user_tokens")
      .update({
        balance,
        monthly_grant: grant.amount,
        plan,
        last_granted_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("user_id", userId);
    await writeLedger(userId, grant.amount, balance, "monthly_grant", null, { plan });
    return { balance, monthly_grant: grant.amount, plan, last_granted_at: now.toISOString() };
  }

  // Keep stored plan/grant in sync without crediting tokens.
  if (planChanged || existing.monthly_grant !== grant.amount) {
    await supabaseAdmin
      .from("user_tokens")
      .update({ plan, monthly_grant: grant.amount, updated_at: now.toISOString() })
      .eq("user_id", userId);
  }

  return { balance, monthly_grant: grant.amount, plan, last_granted_at: existing.last_granted_at as string };
}

export async function getTokenBalance(userId: string): Promise<number> {
  return (await getTokenAccount(userId)).balance;
}

// ─── Spend ──────────────────────────────────────────────────────────────────

export interface SpendResult {
  ok: boolean;
  balance: number;
  reason?: string;
}

// Atomic-enough spend: re-reads balance, then conditionally decrements. Returns
// ok=false (without charging) when the balance can't cover the cost.
export async function deductTokens(
  userId: string,
  amount: number,
  feature: TokenFeature | string,
  metadata: Record<string, unknown> = {},
  opts: { meterFree?: boolean } = {}
): Promise<SpendResult> {
  const account = await getTokenAccount(userId);

  // Free tier is unmetered for interview trials (gated separately). For other
  // features (e.g. the optimize pipeline) pass meterFree to bound free usage to
  // the one-time 500-token grant.
  if (account.plan === "free" && !opts.meterFree) {
    return { ok: true, balance: account.balance };
  }

  if (account.balance < amount) {
    return {
      ok: false,
      balance: account.balance,
      reason: `Not enough tokens — this needs ${amount}, you have ${account.balance}. Upgrade your plan or top up to continue.`,
    };
  }

  const next = account.balance - amount;
  // Conditional update guards against a concurrent spend racing past zero.
  const { data, error } = await supabaseAdmin
    .from("user_tokens")
    .update({ balance: next, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .gte("balance", amount)
    .select("balance")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, balance: account.balance, reason: "Could not reserve tokens. Please retry." };
  }

  const balanceAfter = data.balance as number;
  await writeLedger(userId, -amount, balanceAfter, String(feature), String(feature), metadata);
  return { ok: true, balance: balanceAfter };
}

// Add tokens (monthly top-ups via Stripe, refunds, promos). Wired in Phase 39.
export async function addTokens(
  userId: string,
  amount: number,
  reason: string,
  metadata: Record<string, unknown> = {}
): Promise<number> {
  const account = await getTokenAccount(userId);
  const next = account.balance + amount;
  await supabaseAdmin
    .from("user_tokens")
    .update({ balance: next, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  await writeLedger(userId, amount, next, reason, null, metadata);
  return next;
}
