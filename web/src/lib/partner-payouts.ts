import { supabaseAdmin } from "@/lib/supabase";
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
