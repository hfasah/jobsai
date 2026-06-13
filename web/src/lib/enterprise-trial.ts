import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase";

// One free trial per company. We block a repeat trial by email, by Stripe
// customer, and by company domain — so cancelling on day 14 and signing up
// again doesn't earn a second trial. Admins can still grant manual extensions.
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com",
  "proton.me", "protonmail.com", "aol.com", "live.com", "msn.com",
]);

export function domainOf(email?: string | null): string | null {
  if (!email || !email.includes("@")) return null;
  return email.split("@")[1]?.toLowerCase().trim() || null;
}

async function exists(column: string, value: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("enterprise_trial_usage")
    .select("id")
    .eq(column, value)
    .limit(1);
  return Boolean(data && data.length);
}

/** True if this email / customer / company domain has already used a trial. */
export async function hasUsedTrial(opts: { email?: string | null; customerId?: string | null }): Promise<boolean> {
  const email = opts.email?.toLowerCase().trim() || null;
  if (email && (await exists("email", email))) return true;
  if (opts.customerId && (await exists("stripe_customer_id", opts.customerId))) return true;
  const domain = domainOf(email);
  if (domain && !FREE_EMAIL_DOMAINS.has(domain) && (await exists("domain", domain))) return true;
  return false;
}

export async function recordTrialUsage(opts: {
  orgId: string;
  email?: string | null;
  customerId?: string | null;
}): Promise<void> {
  const email = opts.email?.toLowerCase().trim() || null;
  await supabaseAdmin.from("enterprise_trial_usage").insert({
    org_id: opts.orgId,
    email,
    domain: domainOf(email),
    stripe_customer_id: opts.customerId ?? null,
  });
}

/** Record trial usage when a subscription actually enters the trial (webhook). */
export async function recordTrialFromSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  if (!customerId) return;
  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();
  if (!org) return;
  if (await exists("stripe_customer_id", customerId)) return; // already recorded

  let email: string | null = null;
  try {
    const cust = await getStripe().customers.retrieve(customerId);
    if (cust && !("deleted" in cust && cust.deleted)) email = (cust as Stripe.Customer).email ?? null;
  } catch {
    // best-effort
  }
  await recordTrialUsage({ orgId: (org as { id: string }).id, email, customerId });
}
