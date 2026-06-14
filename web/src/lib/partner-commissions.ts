import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase";
import { commissionAvailableAt } from "@/lib/partner-program";
import { PARTNER_COMMISSION_MONTHS } from "@/lib/enterprise-partners";

// The commission engine: paid invoices → partner commissions (cash), reversed on
// refund. Commission is computed on COLLECTED revenue (invoice.amount_paid), at
// the partner's current rate, within a 12-month window from first conversion.

type ReferralRow = {
  id: string;
  partner_id: string;
  status: string;
  converted_at: string | null;
};

async function orgIdByCustomer(customerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  return data?.id ?? null;
}

async function referralForOrg(orgId: string): Promise<ReferralRow | null> {
  const { data } = await supabaseAdmin
    .from("partner_referrals")
    .select("id,partner_id,status,converted_at")
    .eq("org_id", orgId)
    .maybeSingle();
  return (data as ReferralRow | null) ?? null;
}

// Create a commission for a successfully collected invoice. Idempotent per
// invoice id (the unique constraint also guards against double-processing).
export async function recordCommissionForInvoice(invoice: Stripe.Invoice): Promise<void> {
  const amountPaid = invoice.amount_paid ?? 0;
  const invoiceId = invoice.id;
  if (!invoiceId || amountPaid <= 0) return;

  const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const orgId = await orgIdByCustomer(customerId);
  if (!orgId) return;

  const referral = await referralForOrg(orgId);
  if (!referral) return;

  // Idempotency: don't double-record an invoice.
  const { data: existing } = await supabaseAdmin
    .from("partner_commissions")
    .select("id")
    .eq("invoice_id", invoiceId)
    .maybeSingle();
  if (existing) return;

  // First paid invoice converts the referral and starts the 12-month window.
  const firstPaidAt = referral.converted_at ?? new Date().toISOString();
  if (referral.status !== "active" || !referral.converted_at) {
    await supabaseAdmin
      .from("partner_referrals")
      .update({ status: "active", converted_at: firstPaidAt })
      .eq("id", referral.id);
  }

  // Enforce the commission window (12 months from first conversion).
  const windowEnd = new Date(firstPaidAt);
  windowEnd.setMonth(windowEnd.getMonth() + PARTNER_COMMISSION_MONTHS);
  const invoiceTime = invoice.created ? new Date(invoice.created * 1000) : new Date();
  if (invoiceTime.getTime() > windowEnd.getTime()) return;

  // Partner's current rate.
  const { data: partner } = await supabaseAdmin
    .from("partner_accounts")
    .select("commission_rate")
    .eq("id", referral.partner_id)
    .maybeSingle();
  const rate = Number(partner?.commission_rate ?? 0);
  if (rate <= 0) return;

  const amountCents = Math.round((amountPaid * rate) / 100);
  if (amountCents <= 0) return;

  await supabaseAdmin.from("partner_commissions").insert({
    partner_id: referral.partner_id,
    referral_id: referral.id,
    invoice_id: invoiceId,
    amount_cents: amountCents,
    currency: invoice.currency ?? "usd",
    rate,
    status: "approved", // accrued; becomes payable after the hold (available_at)
    available_at: commissionAvailableAt(invoiceTime).toISOString(),
  });
}

// Refund / chargeback: reverse the commission tied to that invoice, unless it
// was already paid out (those need a clawback against future earnings — TODO).
export async function reverseCommissionForInvoice(invoiceId: string): Promise<void> {
  if (!invoiceId) return;
  await supabaseAdmin
    .from("partner_commissions")
    .update({ status: "reversed" })
    .eq("invoice_id", invoiceId)
    .neq("status", "paid");
}

// When a referred subscription ends, mark the referral cancelled (stops future
// commissions; already-accrued ones stand).
export async function cancelReferralForCustomer(customerId: string): Promise<void> {
  const orgId = await orgIdByCustomer(customerId);
  if (!orgId) return;
  await supabaseAdmin
    .from("partner_referrals")
    .update({ status: "cancelled" })
    .eq("org_id", orgId)
    .neq("status", "cancelled");
}
