import { supabaseAdmin } from "@/lib/supabase";
import { getUserPlan, type Plan } from "@/lib/billing";

// ─── Economics ──────────────────────────────────────────────────────────────
// Token costs are tuned so the price a user pays always exceeds the underlying
// API cost (see project pricing model). Cheap features feel ~unlimited on paid
// plans; voice/avatar are metered per-minute.

export const TOKEN_COSTS = {
  written_eval: 50,    // one written-coach answer evaluation (~$0.10 API)
  auto_apply: 600,     // one browser-agent application (~$0.80 Skyvern → ~2.25× margin)
  resume_tailor: 30,
  cover_letter: 30,
  ats_scan: 20,
  linkedin_optimize: 30, // full LinkedIn profile rewrite + audit
  linkedin_post: 20,     // one generated LinkedIn writeup
  voice_minute: 60,    // ~600 for a 10-min voice interview
  avatar_minute: 250,  // ~2,500 for a 10-min avatar interview
  coaching_session: 20_000, // 45-min 1:1 human career coach ≈ $75 (aligned with Premium's $79/20K)
} as const;

export type TokenFeature = keyof typeof TOKEN_COSTS;

// Monthly allowance per plan. Free is a one-time grant; paid plans re-grant each
// month. Phase 39 extends this map to premium / accelerator tiers.
// Unused monthly grant rolls over, capped at this many months of the allowance.
export const ROLLOVER_CAP_MONTHS = 2;

// All plans re-grant monthly. Unused grant rolls over up to ROLLOVER_CAP_MONTHS;
// PURCHASED top-ups persist separately and never expire (see two-bucket model).
export const PLAN_TOKEN_GRANTS: Record<Plan, { amount: number; recurring: boolean }> = {
  free:        { amount: 500,    recurring: true },
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
  balance: number;        // total spendable = grant_balance + topup_balance
  grant_balance: number;  // monthly allowance — resets, no carryover
  topup_balance: number;  // purchased — persists, never reset
  monthly_grant: number;
  plan: Plan;
  last_granted_at: string;
}

// Read buckets from a row, tolerating the pre-052 schema (columns absent).
// Fallback treats the whole legacy balance as PURCHASED so a reset can never
// wipe it — the safe default until the migration lands.
function readBuckets(row: Record<string, unknown>): { grant: number; topup: number } {
  const balance = (row.balance as number) ?? 0;
  const hasBuckets = row.grant_balance != null || row.topup_balance != null;
  if (!hasBuckets) return { grant: 0, topup: balance };
  return { grant: (row.grant_balance as number) ?? 0, topup: (row.topup_balance as number) ?? 0 };
}

// Best-effort write of the bucket columns — separate from the guaranteed
// `balance` write so a missing 052 migration never breaks token operations.
async function writeBuckets(userId: string, grant: number, topup: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from("user_tokens")
    .update({ grant_balance: grant, topup_balance: topup })
    .eq("user_id", userId);
  if (error) console.warn("[tokens] bucket write skipped (run migration 052?):", error.message);
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

  // select("*") so this works whether or not the 052 bucket columns exist yet.
  const { data: existing } = await supabaseAdmin
    .from("user_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // First touch → create with the initial grant (all of it is grant, no top-ups).
  if (!existing) {
    const nowIso = new Date().toISOString();
    await supabaseAdmin.from("user_tokens").insert({
      user_id: userId,
      balance: grant.amount,
      monthly_grant: grant.amount,
      plan,
      last_granted_at: nowIso,
      updated_at: nowIso,
    });
    await writeBuckets(userId, grant.amount, 0);
    await writeLedger(userId, grant.amount, grant.amount, "signup_grant", null, { plan });
    return { balance: grant.amount, grant_balance: grant.amount, topup_balance: 0, monthly_grant: grant.amount, plan, last_granted_at: nowIso };
  }

  const { grant: grantBalPrev, topup } = readBuckets(existing as Record<string, unknown>);
  const lastGranted = new Date(existing.last_granted_at as string);
  const now = new Date();
  const planChanged = existing.plan !== plan;

  const needsMonthly = grant.recurring && !sameMonth(lastGranted, now);
  const needsUpgradeGrant = planChanged && grant.recurring;

  if (needsMonthly || needsUpgradeGrant) {
    // Unused grant ROLLS OVER, capped at ROLLOVER_CAP_MONTHS months of the
    // allowance. Purchased top-ups are untouched and never expire.
    // Pre-052 fallback (grant=0, topup=legacy balance) degrades to "add", so no
    // one loses tokens before the migration runs.
    const newGrant = Math.min(grantBalPrev + grant.amount, ROLLOVER_CAP_MONTHS * grant.amount);
    const newBalance = newGrant + topup;
    await supabaseAdmin
      .from("user_tokens")
      .update({ balance: newBalance, monthly_grant: grant.amount, plan, last_granted_at: now.toISOString(), updated_at: now.toISOString() })
      .eq("user_id", userId);
    await writeBuckets(userId, newGrant, topup);
    await writeLedger(userId, grant.amount, newBalance, "monthly_grant", null, { plan, reset: true });
    return { balance: newBalance, grant_balance: newGrant, topup_balance: topup, monthly_grant: grant.amount, plan, last_granted_at: now.toISOString() };
  }

  // Keep stored plan/grant in sync without crediting tokens.
  if (planChanged || existing.monthly_grant !== grant.amount) {
    await supabaseAdmin
      .from("user_tokens")
      .update({ plan, monthly_grant: grant.amount, updated_at: now.toISOString() })
      .eq("user_id", userId);
  }

  const { grant: grantBal } = readBuckets(existing as Record<string, unknown>);
  return {
    balance: (existing.balance as number) ?? grantBal + topup,
    grant_balance: grantBal,
    topup_balance: topup,
    monthly_grant: grant.amount,
    plan,
    last_granted_at: existing.last_granted_at as string,
  };
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
  // Conditional update on the total guards against a concurrent spend racing
  // past zero. The total `balance` is the source of truth for affordability.
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

  // Spend the monthly grant first, then purchased top-ups (best-effort buckets).
  const fromGrant = Math.min(account.grant_balance, amount);
  const newGrant = account.grant_balance - fromGrant;
  const newTopup = account.topup_balance - (amount - fromGrant);
  await writeBuckets(userId, newGrant, newTopup);

  const balanceAfter = data.balance as number;
  await writeLedger(userId, -amount, balanceAfter, String(feature), String(feature), {
    ...metadata,
    from_grant: fromGrant,
    from_topup: amount - fromGrant,
  });
  return { ok: true, balance: balanceAfter };
}

// Add tokens (purchased Stripe packs, refunds, promos). Credits the PURCHASED
// bucket by default so it persists and is never wiped by a monthly reset.
export async function addTokens(
  userId: string,
  amount: number,
  reason: string,
  metadata: Record<string, unknown> = {},
  opts: { bucket?: "grant" | "topup" } = {}
): Promise<number> {
  const account = await getTokenAccount(userId);
  const next = account.balance + amount;
  await supabaseAdmin
    .from("user_tokens")
    .update({ balance: next, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (opts.bucket === "grant") {
    await writeBuckets(userId, account.grant_balance + amount, account.topup_balance);
  } else {
    await writeBuckets(userId, account.grant_balance, account.topup_balance + amount);
  }
  await writeLedger(userId, amount, next, reason, null, metadata);
  return next;
}
