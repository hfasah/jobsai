import { supabaseAdmin } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { getConnectStatus } from "@/lib/partner-connect";
import { PARTNER_MIN_PAYOUT_CENTS } from "@/lib/enterprise-partners";
import { getPartnerStats, type PartnerAccount, type PartnerStats } from "@/lib/partner-program";

export type AdminPartnerRow = PartnerAccount & { stats: PartnerStats };

// All partners with their referral/commission stats, newest first.
export async function listPartnersForAdmin(): Promise<AdminPartnerRow[]> {
  const { data } = await supabaseAdmin
    .from("partner_accounts")
    .select("*")
    .order("created_at", { ascending: false });
  const partners = (data as PartnerAccount[] | null) ?? [];
  return Promise.all(
    partners.map(async (p) => ({ ...p, stats: await getPartnerStats(p.id) })),
  );
}

// Settle a partner's cleared commissions (approved + past the hold) into a
// single payout batch and mark them paid. Returns the amount settled in cents.
export async function payOutPartner(
  partnerId: string,
  opts: { method?: string | null; reference?: string | null; adminUserId?: string | null } = {},
): Promise<{ amountCents: number; commissionCount: number }> {
  const nowIso = new Date().toISOString();

  const { data: due } = await supabaseAdmin
    .from("partner_commissions")
    .select("id,amount_cents,currency")
    .eq("partner_id", partnerId)
    .eq("status", "approved")
    .is("payout_id", null)
    .lte("available_at", nowIso);

  const rows = due ?? [];
  if (rows.length === 0) return { amountCents: 0, commissionCount: 0 };

  const amountCents = rows.reduce((s, r) => s + (r.amount_cents ?? 0), 0);
  const currency = rows[0]?.currency ?? "usd";

  const { data: payout, error } = await supabaseAdmin
    .from("partner_payouts")
    .insert({
      partner_id: partnerId,
      amount_cents: amountCents,
      currency,
      method: opts.method ?? null,
      reference: opts.reference ?? null,
      commission_count: rows.length,
      created_by: opts.adminUserId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabaseAdmin
    .from("partner_commissions")
    .update({ status: "paid", paid_at: nowIso, payout_id: payout.id })
    .in("id", rows.map((r) => r.id));

  return { amountCents, commissionCount: rows.length };
}

export type CronPayoutResult = {
  considered: number;
  paid: { partnerId: string; amountCents: number; transferId: string }[];
  skipped: { partnerId: string; reason: string }[];
};

// Monthly automated payouts via Stripe Connect: for each active partner whose
// connected account can receive transfers, settle their cleared commissions
// (past the 2-month hold) if the balance clears the minimum threshold. Partners
// without Connect are left for the manual admin payout queue.
export async function runMonthlyPartnerPayouts(): Promise<CronPayoutResult> {
  const nowIso = new Date().toISOString();
  const result: CronPayoutResult = { considered: 0, paid: [], skipped: [] };

  const { data: partners } = await supabaseAdmin
    .from("partner_accounts")
    .select("id,stripe_connect_id")
    .eq("status", "active")
    .not("stripe_connect_id", "is", null);

  for (const p of partners ?? []) {
    result.considered++;
    const connectId = p.stripe_connect_id as string;

    const { data: due } = await supabaseAdmin
      .from("partner_commissions")
      .select("id,amount_cents,currency")
      .eq("partner_id", p.id)
      .eq("status", "approved")
      .is("payout_id", null)
      .lte("available_at", nowIso);

    const rows = due ?? [];
    const amountCents = rows.reduce((s, r) => s + (r.amount_cents ?? 0), 0);
    if (amountCents < PARTNER_MIN_PAYOUT_CENTS) {
      result.skipped.push({ partnerId: p.id, reason: "below_threshold" });
      continue;
    }

    const status = await getConnectStatus(connectId);
    if (!status.payoutsEnabled) {
      result.skipped.push({ partnerId: p.id, reason: "connect_not_ready" });
      continue;
    }

    const currency = rows[0]?.currency ?? "usd";
    try {
      const transfer = await getStripe().transfers.create(
        { amount: amountCents, currency, destination: connectId, metadata: { partner_id: p.id } },
        { idempotencyKey: `partner-payout-${p.id}-${nowIso.slice(0, 7)}` },
      );

      const { data: payout, error } = await supabaseAdmin
        .from("partner_payouts")
        .insert({
          partner_id: p.id,
          amount_cents: amountCents,
          currency,
          method: "stripe_connect",
          reference: transfer.id,
          commission_count: rows.length,
          created_by: "cron",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      await supabaseAdmin
        .from("partner_commissions")
        .update({ status: "paid", paid_at: nowIso, payout_id: payout.id })
        .in("id", rows.map((r) => r.id));

      result.paid.push({ partnerId: p.id, amountCents, transferId: transfer.id });
    } catch (e) {
      result.skipped.push({ partnerId: p.id, reason: e instanceof Error ? e.message : "transfer_failed" });
    }
  }

  return result;
}
