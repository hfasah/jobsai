import { supabaseAdmin } from "@/lib/supabase";

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
  user_id: string;
  company_name: string | null;
  email: string | null;
  referral_code: string;
  tier: string;
  commission_rate: number;
  stripe_connect_id: string | null;
  status: string;
  created_at: string;
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

// Create a partner account with a unique referral code (idempotent per user).
export async function ensurePartnerAccount(
  userId: string,
  fields: { company_name?: string | null; email?: string | null } = {},
): Promise<PartnerAccount> {
  const existing = await getPartnerByUser(userId);
  if (existing) return existing;

  let code = genReferralCode();
  for (let i = 0; i < 5; i++) {
    if (!(await getPartnerByCode(code))) break;
    code = genReferralCode();
  }

  const { data, error } = await supabaseAdmin
    .from("partner_accounts")
    .insert({
      user_id: userId,
      company_name: fields.company_name ?? null,
      email: fields.email ?? null,
      referral_code: code,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as PartnerAccount;
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
