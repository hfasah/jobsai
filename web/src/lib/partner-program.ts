import { supabaseAdmin } from "@/lib/supabase";
import { FOUNDING_PARTNER_LIMIT, FOUNDING_PARTNER_RATE, PARTNER_BASE_RATE, PARTNER_PAYOUT_HOLD_DAYS } from "@/lib/enterprise-partners";

// Server-side helpers for the Partner Program (referrals + commissions).
// Public marketing copy lives in lib/enterprise-partners.ts; this module is the
// data layer used by attribution, the dashboard, and (later) the payout job.

export const PARTNER_REF_COOKIE = "jobsai_ref";
export const PARTNER_REF_COOKIE_DAYS = 90;
export const PARTNER_REF_MAX_AGE = 60 * 60 * 24 * PARTNER_REF_COOKIE_DAYS;
// Codes are A–Z/0–9 (we mint from an unambiguous alphabet) but accept a slightly
// looser shape so older/imported codes still resolve.
export const REFERRAL_CODE_RE = /^[A-Za-z0-9_-]{4,32}$/;

export type PartnerAccount = {
  id: string;
  user_id: string | null;
  name: string | null;
  company_name: string | null;
  email: string | null;
  website: string | null;
  linkedin: string | null;
  audience_type: string | null;
  estimated_referrals: string | null;
  referral_code: string;
  tier: string;
  commission_rate: number;
  stripe_connect_id: string | null;
  payout_method: string | null;
  payout_email: string | null;
  payout_details: string | null;
  is_founding: boolean;
  verified: boolean;
  verify_code: string | null;
  verify_expires_at: string | null;
  status: string; // pending | active | suspended
  approved_at: string | null;
  created_at: string;
};


export type PartnerStats = {
  referrals: number;
  payingCustomers: number;
  // commission amounts in cents
  lifetimeEarnedCents: number;
  paidCents: number;
  availableCents: number; // cleared past the hold, not yet paid
  pendingCents: number; // accruing or still in the hold window
};

// Unambiguous alphabet (no 0/O/1/I/L) for human-shareable codes.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function genReferralCode(len = 7): string {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

export async function getPartnerByCode(code: string | null | undefined): Promise<PartnerAccount | null> {
  if (!code || !REFERRAL_CODE_RE.test(code)) return null;
  const { data } = await supabaseAdmin
    .from("partner_accounts")
    .select("*")
    .ilike("referral_code", code)
    .maybeSingle();
  return (data as PartnerAccount | null) ?? null;
}

export async function getPartnerByUser(userId: string): Promise<PartnerAccount | null> {
  const { data } = await supabaseAdmin
    .from("partner_accounts")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as PartnerAccount | null) ?? null;
}

export async function getPartnerByEmail(email: string): Promise<PartnerAccount | null> {
  if (!email) return null;
  const { data } = await supabaseAdmin
    .from("partner_accounts")
    .select("*")
    .ilike("email", email.trim())
    .maybeSingle();
  return (data as PartnerAccount | null) ?? null;
}

// Founding partners are the first FOUNDING_PARTNER_LIMIT *live* (active) partners.
async function foundingEligible(): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from("partner_accounts")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  return (count ?? 0) < FOUNDING_PARTNER_LIMIT;
}

export function genVerifyCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

type ApplyFields = {
  name?: string | null;
  email: string;
  company_name?: string | null;
  website?: string | null;
  linkedin?: string | null;
  audience_type?: string | null;
  estimated_referrals?: string | null;
};

// Create or refresh a partner application (status pending, unverified) and stash
// a fresh verification code. Returns the partner row + the plaintext code (the
// caller delivers it by email/SMS — it is never returned to the client).
export async function upsertPartnerApplication(
  fields: ApplyFields,
  channel: "email" | "sms" = "email",
): Promise<{ partner: PartnerAccount; code: string; alreadyVerified: boolean }> {
  const email = fields.email.trim();
  const existing = await getPartnerByEmail(email);
  const code = genVerifyCode();
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  if (existing) {
    if (existing.verified) return { partner: existing, code, alreadyVerified: true };
    const { data, error } = await supabaseAdmin
      .from("partner_accounts")
      .update({
        name: fields.name ?? existing.name,
        company_name: fields.company_name ?? existing.company_name,
        website: fields.website ?? existing.website,
        linkedin: fields.linkedin ?? existing.linkedin,
        audience_type: fields.audience_type ?? existing.audience_type,
        estimated_referrals: fields.estimated_referrals ?? existing.estimated_referrals,
        verify_code: code,
        verify_expires_at: expires,
        verify_channel: channel,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { partner: data as PartnerAccount, code, alreadyVerified: false };
  }

  let referral = genReferralCode();
  for (let i = 0; i < 5; i++) {
    if (!(await getPartnerByCode(referral))) break;
    referral = genReferralCode();
  }

  const { data, error } = await supabaseAdmin
    .from("partner_accounts")
    .insert({
      name: fields.name ?? null,
      email,
      company_name: fields.company_name ?? null,
      website: fields.website ?? null,
      linkedin: fields.linkedin ?? null,
      audience_type: fields.audience_type ?? null,
      estimated_referrals: fields.estimated_referrals ?? null,
      referral_code: referral,
      status: "pending",
      verified: false,
      verify_code: code,
      verify_expires_at: expires,
      verify_channel: channel,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return { partner: data as PartnerAccount, code, alreadyVerified: false };
}

// Confirm the code → activate the partner and lock in the founding rate if they
// land in the first cohort. Returns the activated partner (with referral code).
export async function verifyPartnerApplication(
  email: string,
  code: string,
): Promise<{ ok: true; partner: PartnerAccount } | { ok: false; error: string }> {
  const partner = await getPartnerByEmail(email);
  if (!partner) return { ok: false, error: "No application found for that email." };
  if (partner.verified) return { ok: true, partner };
  if (!partner.verify_code || partner.verify_code !== code.trim()) {
    return { ok: false, error: "That code is incorrect." };
  }
  if (partner.verify_expires_at && new Date(partner.verify_expires_at) < new Date()) {
    return { ok: false, error: "That code has expired — request a new one." };
  }

  const founding = await foundingEligible();
  const { data, error } = await supabaseAdmin
    .from("partner_accounts")
    .update({
      verified: true,
      status: "active",
      approved_at: new Date().toISOString(),
      is_founding: founding,
      commission_rate: founding ? FOUNDING_PARTNER_RATE : PARTNER_BASE_RATE,
      tier: founding ? "growth" : "recruiting",
      verify_code: null,
      verify_expires_at: null,
    })
    .eq("id", partner.id)
    .select("*")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, partner: data as PartnerAccount };
}

// Create a partner account with a unique referral code (idempotent per user).
// The first FOUNDING_PARTNER_LIMIT partners lock the higher founding rate.
export async function ensurePartnerAccount(
  userId: string,
  fields: {
    company_name?: string | null;
    email?: string | null;
    website?: string | null;
    audience_type?: string | null;
  } = {},
): Promise<PartnerAccount> {
  const existing = await getPartnerByUser(userId);
  if (existing) return existing;

  let code = genReferralCode();
  for (let i = 0; i < 5; i++) {
    if (!(await getPartnerByCode(code))) break;
    code = genReferralCode();
  }

  const founding = await foundingEligible();

  const { data, error } = await supabaseAdmin
    .from("partner_accounts")
    .insert({
      user_id: userId,
      company_name: fields.company_name ?? null,
      email: fields.email ?? null,
      website: fields.website ?? null,
      audience_type: fields.audience_type ?? null,
      referral_code: code,
      is_founding: founding,
      commission_rate: founding ? FOUNDING_PARTNER_RATE : PARTNER_BASE_RATE,
      tier: founding ? "growth" : "recruiting",
      verified: true, // signed-in via Clerk → identity verified
      status: "pending", // admin approves before the partner goes live
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PartnerAccount;
}

// Aggregate the partner's referrals + commissions for the dashboard.
export async function getPartnerStats(partnerId: string): Promise<PartnerStats> {
  const { data: refs } = await supabaseAdmin
    .from("partner_referrals")
    .select("status")
    .eq("partner_id", partnerId);
  const referrals = refs?.length ?? 0;
  const payingCustomers = (refs ?? []).filter((r) => r.status === "active").length;

  const { data: comms } = await supabaseAdmin
    .from("partner_commissions")
    .select("amount_cents,status,available_at")
    .eq("partner_id", partnerId);

  const now = Date.now();
  let lifetimeEarnedCents = 0;
  let paidCents = 0;
  let availableCents = 0;
  let pendingCents = 0;
  for (const c of comms ?? []) {
    const amt = c.amount_cents ?? 0;
    if (c.status === "reversed") continue;
    lifetimeEarnedCents += amt;
    if (c.status === "paid") {
      paidCents += amt;
    } else if (c.status === "approved" && c.available_at && new Date(c.available_at).getTime() <= now) {
      availableCents += amt;
    } else {
      pendingCents += amt;
    }
  }

  return { referrals, payingCustomers, lifetimeEarnedCents, paidCents, availableCents, pendingCents };
}

// When in the payout window a freshly-collected commission becomes available.
export function commissionAvailableAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + PARTNER_PAYOUT_HOLD_DAYS * 24 * 60 * 60 * 1000);
}

// Attribute a newly created org to a partner by referral code. Idempotent: one
// credit per org, and never self-refers (a partner referring their own org).
export async function attributeOrgToPartner(
  orgId: string,
  code: string | null | undefined,
  opts: { referredEmail?: string | null; createdByUserId?: string | null } = {},
): Promise<void> {
  const partner = await getPartnerByCode(code);
  if (!partner) return;
  if (opts.createdByUserId && partner.user_id === opts.createdByUserId) return;

  const { data: existing } = await supabaseAdmin
    .from("partner_referrals")
    .select("id")
    .eq("org_id", orgId)
    .maybeSingle();
  if (existing) return;

  await supabaseAdmin.from("partner_referrals").insert({
    partner_id: partner.id,
    org_id: orgId,
    referred_email: opts.referredEmail ?? null,
    status: "pending",
  });
}
