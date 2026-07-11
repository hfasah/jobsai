// Sourcing credit system. Spend/grant go through the SQL functions from
// migration 130 so balances stay consistent under concurrency; this module is
// the only place that should touch them. SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";
import { getOrgEntitlements } from "@/lib/enterprise-entitlements";
import type { CreditAction } from "./types";

const SPEND_REASON: Record<CreditAction, string> = {
  search: "spend_search",
  unlock_profile: "spend_unlock_profile",
  reveal_email: "spend_reveal_email",
  reveal_phone: "spend_reveal_phone",
  enrich: "spend_enrich",
};

const FALLBACK_COSTS: Record<CreditAction, number> = {
  search: 1,
  unlock_profile: 1,
  reveal_email: 2,
  reveal_phone: 5,
  enrich: 3,
};

// Platform defaults (org_id null) overlaid by per-org overrides.
export async function getCreditCosts(orgId: string): Promise<Record<CreditAction, number>> {
  const { data } = await supabaseAdmin
    .from("sourcing_credit_costs")
    .select("org_id, action, cost")
    .or(`org_id.is.null,org_id.eq.${orgId}`);
  const costs = { ...FALLBACK_COSTS };
  const rows = (data ?? []) as { org_id: string | null; action: CreditAction; cost: number }[];
  for (const row of rows.filter((r) => r.org_id === null)) costs[row.action] = row.cost;
  for (const row of rows.filter((r) => r.org_id !== null)) costs[row.action] = row.cost;
  return costs;
}

export async function getCreditState(orgId: string): Promise<{
  balance: number;
  monthlyAllowance: number;
  usedThisMonth: number;
}> {
  const period = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [{ data: bal }, ent, { data: spent }] = await Promise.all([
    supabaseAdmin.from("sourcing_credit_balances").select("balance").eq("org_id", orgId).maybeSingle(),
    getOrgEntitlements(orgId),
    supabaseAdmin
      .from("sourcing_credit_ledger")
      .select("amount")
      .eq("org_id", orgId)
      .lt("amount", 0)
      .gte("created_at", `${period}-01`),
  ]);
  const usedThisMonth = ((spent ?? []) as { amount: number }[]).reduce((sum, r) => sum - r.amount, 0);
  return {
    balance: (bal as { balance?: number } | null)?.balance ?? 0,
    monthlyAllowance: ent.limits.sourcing_credits_monthly ?? 0,
    usedThisMonth,
  };
}

// Lazily apply this month's plan allowance. Idempotent per (org, period) via
// the partial unique index — cheap to call at the top of any credit route.
export async function ensureMonthlyGrant(orgId: string): Promise<void> {
  try {
    const ent = await getOrgEntitlements(orgId);
    const allowance = ent.limits.sourcing_credits_monthly ?? 0;
    if (allowance <= 0) return;
    const period = new Date().toISOString().slice(0, 7);
    await supabaseAdmin.rpc("sourcing_grant_credits", {
      p_org: orgId,
      p_amount: allowance,
      p_reason: "monthly_grant",
      p_period: period,
      p_ref_type: null,
      p_ref_id: null,
      p_user: null,
    });
  } catch (e) {
    console.error("[sourcing] monthly grant failed", e);
  }
}

// Today's spend (UTC) vs. the org's optional daily cap. Advisory cost
// control — checked before the atomic spend, so treat it as a soft limit.
async function dailyCapExceeded(orgId: string, adding: number): Promise<boolean> {
  const { data: settings } = await supabaseAdmin
    .from("sourcing_org_settings")
    .select("daily_credit_limit")
    .eq("org_id", orgId)
    .maybeSingle();
  const cap = (settings as { daily_credit_limit?: number | null } | null)?.daily_credit_limit;
  if (!cap || cap <= 0) return false;
  const today = new Date().toISOString().slice(0, 10);
  const { data: spent } = await supabaseAdmin
    .from("sourcing_credit_ledger")
    .select("amount")
    .eq("org_id", orgId)
    .lt("amount", 0)
    .gte("created_at", `${today}T00:00:00Z`);
  const used = ((spent ?? []) as { amount: number }[]).reduce((sum, r) => sum - r.amount, 0);
  return used + adding > cap;
}

export async function spendCredits(args: {
  orgId: string;
  userId: string;
  action: CreditAction;
  refType: "run" | "reveal";
  refId: string;
}): Promise<{ ok: boolean; balance: number; ledgerEntryId: string | null; cost: number; dailyCap?: boolean }> {
  const costs = await getCreditCosts(args.orgId);
  const cost = costs[args.action];
  if (cost === 0) return { ok: true, balance: -1, ledgerEntryId: null, cost: 0 };

  if (await dailyCapExceeded(args.orgId, cost)) {
    return { ok: false, balance: 0, ledgerEntryId: null, cost, dailyCap: true };
  }

  const { data, error } = await supabaseAdmin.rpc("sourcing_spend_credits", {
    p_org: args.orgId,
    p_amount: cost,
    p_reason: SPEND_REASON[args.action],
    p_ref_type: args.refType,
    p_ref_id: args.refId,
    p_user: args.userId,
  });
  if (error) {
    console.error("[sourcing] spend failed", error);
    return { ok: false, balance: 0, ledgerEntryId: null, cost };
  }
  const row = (Array.isArray(data) ? data[0] : data) as { ok: boolean; balance: number; ledger_id: string | null } | null;
  return { ok: row?.ok ?? false, balance: row?.balance ?? 0, ledgerEntryId: row?.ledger_id ?? null, cost };
}

export async function refundCredits(args: {
  orgId: string;
  userId: string;
  amount: number;
  refType: "run" | "reveal";
  refId: string;
  note?: string;
}): Promise<void> {
  if (args.amount <= 0) return;
  try {
    await supabaseAdmin.rpc("sourcing_grant_credits", {
      p_org: args.orgId,
      p_amount: args.amount,
      p_reason: "refund",
      p_period: null,
      p_ref_type: args.refType,
      p_ref_id: args.refId,
      p_user: args.userId,
    });
  } catch (e) {
    console.error("[sourcing] refund failed", e);
  }
}

// Pure helper for the pre-execution "this will cost ~N credits" UI.
export function estimateCost(
  costs: Record<CreditAction, number>,
  actions: Partial<Record<CreditAction, number>>,
): number {
  let total = 0;
  for (const [action, count] of Object.entries(actions) as [CreditAction, number][]) {
    total += (costs[action] ?? 0) * (count ?? 0);
  }
  return total;
}
