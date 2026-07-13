import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";
import { getProvidersForOrg, getEmailVerifier } from "@/lib/sourcing/registry";
import { spendCredits, refundCredits, getCreditCosts, ensureMonthlyGrant } from "@/lib/sourcing/credits";
import { normEmail } from "@/lib/sourcing/normalize";
import type { EmailVerificationStatus, RevealResult } from "@/lib/sourcing/types";

export const maxDuration = 30;

interface StoredContact { value: string; type?: string; verification_status?: EmailVerificationStatus; revealed_at: string }
interface CandidateRow {
  id: string; provider_key: string; provider_record_id: string; linkedin_url: string | null;
  full_name: string | null; suppressed: boolean; profile_unlocked: boolean;
  emails: StoredContact[]; phones: StoredContact[]; raw: Record<string, unknown> | null;
}

function fromCache(raw: CandidateRow["raw"], type: "email" | "phone"): string | null {
  const r = raw as { work_email?: string; recommended_personal_email?: string; emails?: ({ address?: string } | string)[]; mobile_phone?: string; phone_numbers?: string[] } | null;
  if (!r) return null;
  if (type === "email") {
    return r.work_email ?? r.recommended_personal_email ??
      (typeof r.emails?.[0] === "string" ? (r.emails[0] as string) : (r.emails?.[0] as { address?: string } | undefined)?.address) ?? null;
  }
  return r.mobile_phone ?? r.phone_numbers?.[0] ?? null;
}

// POST /api/enterprise/sourcing/results/[id]/unlock — the Full Contact Unlock
// bundle (email + phone + LinkedIn), priced progressively: it charges the full
// bundle price MINUS what the org already paid to reveal on this candidate, and
// only the email rate when no phone is available. Never re-charges unlocked data.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  for (const feature of ["global_sourcing", "contact_reveal"] as const) {
    const gate = await requireFeature(userId, feature);
    if (gate) return gate;
  }
  const denied = await requirePermission(userId, "can_reveal_contacts");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  await ensureMonthlyGrant(org.id);

  const { id } = await ctx.params;

  const { data: result } = await supabaseAdmin
    .from("sourcing_run_results").select("id, external_candidate_id").eq("id", id).eq("org_id", org.id).maybeSingle();
  const resultRow = result as { id: string; external_candidate_id: string | null } | null;
  if (!resultRow?.external_candidate_id) return NextResponse.json({ error: "Result not found." }, { status: 404 });

  const { data: cand } = await supabaseAdmin
    .from("sourcing_external_candidates")
    .select("id, provider_key, provider_record_id, linkedin_url, full_name, suppressed, profile_unlocked, emails, phones, raw")
    .eq("id", resultRow.external_candidate_id).eq("org_id", org.id).maybeSingle();
  const c = cand as CandidateRow | null;
  if (!c) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  if (c.suppressed) return NextResponse.json({ error: "This candidate is on your suppression list." }, { status: 403 });

  const costs = await getCreditCosts(org.id);
  const hadEmail = c.emails.length > 0;
  const hadPhone = c.phones.length > 0;
  const hadProfile = c.profile_unlocked;
  // What the org already paid on this candidate (progressive base).
  const alreadySpent = (hadEmail ? costs.reveal_email : 0) + (hadPhone ? costs.reveal_phone : 0);

  // Already fully unlocked → nothing to do, no charge.
  if (hadEmail && hadPhone && hadProfile) {
    return NextResponse.json({ data: { already: true, emails: c.emails, phones: c.phones, linkedin_url: c.linkedin_url, credits_charged: 0 } });
  }

  // Reveal the missing channels (cache-first for email).
  const providers = await getProvidersForOrg(org.id);
  const resolved = providers.find((p) => p.provider.key === c.provider_key) ?? providers[0];
  const revealChannel = async (kind: "email" | "phone"): Promise<string | null> => {
    const cached = fromCache(c.raw, kind);
    if (cached) return cached;
    if (!resolved?.provider.revealContact) return null;
    try {
      const r: RevealResult = await resolved.provider.revealContact(
        { providerRecordId: c.provider_record_id, linkedinUrl: c.linkedin_url }, kind, { apiKey: resolved.apiKey, timeoutMs: 15000 });
      return r.found && r.value ? r.value : null;
    } catch (e) {
      console.error("[sourcing/unlock] provider error", kind, e);
      return null;
    }
  };

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now, profile_unlocked: true, enriched_at: now };
  let gotEmail = hadEmail;
  let gotPhone = hadPhone;
  let emailValue: string | null = null;
  let emailVerification: EmailVerificationStatus | undefined;

  if (!hadEmail) {
    const value = await revealChannel("email");
    if (value) {
      const { verifier, apiKey } = getEmailVerifier();
      emailVerification = (await verifier.verify(value, { apiKey, timeoutMs: 10000 })).status;
      // Don't count an invalid address as usable (spec: don't charge for invalid).
      if (emailVerification !== "invalid") {
        emailValue = value;
        update.emails = [{ value, verification_status: emailVerification, revealed_at: now }] satisfies StoredContact[];
        update.has_email = true;
        gotEmail = true;
      }
    }
  }
  if (!hadPhone) {
    const value = await revealChannel("phone");
    if (value) {
      update.phones = [{ value, revealed_at: now }] satisfies StoredContact[];
      update.has_phone = true;
      gotPhone = true;
    }
  }

  // Nothing usable and nothing previously unlocked → no charge, no unlock.
  if (!gotEmail && !gotPhone && !hadProfile) {
    return NextResponse.json({ error: "No contact data found — no credits charged.", no_data: true }, { status: 404 });
  }

  // Progressive charge: bundle price when a phone was obtained, else the email
  // rate; minus what was already paid. Clamped at 0.
  const targetPrice = gotPhone ? costs.full_contact_unlock : (gotEmail ? costs.reveal_email : 0);
  const charge = Math.max(0, targetPrice - alreadySpent);

  // Record the unlock (references the spend).
  const { data: revealRow } = await supabaseAdmin
    .from("sourcing_reveals")
    .insert({ org_id: org.id, external_candidate_id: c.id, revealed_by: userId, reveal_type: "full_contact_unlock", provider_key: c.provider_key, status: "success" })
    .select("id").single();
  const revealId = (revealRow as { id: string } | null)?.id ?? null;

  let spend = { ok: true, balance: -1, ledgerEntryId: null as string | null, cost: 0, dailyCap: false as boolean | undefined };
  if (charge > 0 && revealId) {
    spend = await spendCredits({ orgId: org.id, userId, action: "full_contact_unlock", refType: "reveal", refId: revealId, amountOverride: charge });
    if (!spend.ok) {
      // Can't pay → don't persist the unlock; the provider payload stays cached
      // so a later retry won't re-bill the provider.
      await supabaseAdmin.from("sourcing_reveals").update({ status: "failed", result: { error: spend.dailyCap ? "daily_cap" : "insufficient_credits" } }).eq("id", revealId).eq("org_id", org.id);
      return NextResponse.json(
        { error: spend.dailyCap ? "Daily sourcing-credit cap reached." : "Not enough sourcing credits.", credits: true, balance: spend.balance, cost: charge, daily_cap: spend.dailyCap ?? false },
        { status: 402 });
    }
  }

  await supabaseAdmin.from("sourcing_external_candidates").update(update).eq("id", c.id).eq("org_id", org.id);
  if (revealId) {
    await supabaseAdmin.from("sourcing_reveals")
      .update({ credits_spent: spend.cost, ledger_entry_id: spend.ledgerEntryId, status: "success", result: { email: gotEmail, phone: gotPhone, charge } })
      .eq("id", revealId).eq("org_id", org.id);
  }

  after(() => {
    audit({
      org_id: org.id, user_id: userId, action: "sourcing.contact_revealed",
      resource_type: "sourcing_external_candidate", resource_id: c.id,
      metadata: { reveal_type: "full_contact_unlock", provider: c.provider_key, credits: spend.cost, got_email: gotEmail, got_phone: gotPhone },
    });
  });

  return NextResponse.json({
    data: {
      email: emailValue ?? c.emails[0]?.value ?? null,
      email_verification: emailVerification ?? c.emails[0]?.verification_status ?? null,
      phone: gotPhone ? ((update.phones as StoredContact[] | undefined)?.[0]?.value ?? c.phones[0]?.value ?? null) : null,
      linkedin_url: c.linkedin_url,
      credits_charged: spend.cost,
      balance: spend.balance,
    },
  });
}
