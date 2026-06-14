import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";
import type { PartnerAccount } from "@/lib/partner-program";

// Stripe Connect (Express) wiring for partner payouts. Express lets Stripe host
// KYC/tax/bank onboarding; we transfer cleared commissions to the connected
// account. All calls require Connect to be enabled on the Stripe account.

export async function ensureConnectAccount(partner: PartnerAccount): Promise<string> {
  if (partner.stripe_connect_id) return partner.stripe_connect_id;
  const account = await getStripe().accounts.create({
    type: "express",
    email: partner.email ?? undefined,
    capabilities: { transfers: { requested: true } },
    metadata: { partner_id: partner.id },
  });
  await supabaseAdmin
    .from("partner_accounts")
    .update({ stripe_connect_id: account.id })
    .eq("id", partner.id);
  return account.id;
}

export async function createOnboardingLink(accountId: string, origin: string): Promise<string> {
  const link = await getStripe().accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/enterprise/partners/dashboard?connect=refresh`,
    return_url: `${origin}/enterprise/partners/dashboard?connect=done`,
    type: "account_onboarding",
  });
  return link.url;
}

export async function getConnectStatus(
  accountId: string,
): Promise<{ payoutsEnabled: boolean; detailsSubmitted: boolean }> {
  try {
    const acct = await getStripe().accounts.retrieve(accountId);
    return { payoutsEnabled: !!acct.payouts_enabled, detailsSubmitted: !!acct.details_submitted };
  } catch {
    return { payoutsEnabled: false, detailsSubmitted: false };
  }
}
