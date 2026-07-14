import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";
import { syncLeadToCrm } from "@/lib/sourcing/crm-sync";
import { getProvidersForOrg, getEmailVerifier } from "@/lib/sourcing/registry";
import { spendCredits, getCreditCosts, ensureMonthlyGrant, bundleUnitPrice, bundleDiscount } from "@/lib/sourcing/credits";
import { isEmailSuppressed } from "@/lib/outreach/suppression";
import type { EmailVerificationStatus, RevealResult } from "@/lib/sourcing/types";

export const maxDuration = 60;
const MAX_BULK = 50;

interface StoredContact { value: string; verification_status?: EmailVerificationStatus; revealed_at: string }
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

// POST /api/enterprise/sourcing/bulk-unlock  { resultIds: string[] }
// Full-unlocks (email + phone + LinkedIn) many candidates in ONE bundle, with a
// volume discount — cheaper per contact the more you unlock at once. Progressive
// (subtracts what each candidate already paid), skips DNC/suppressed/no-data,
// never re-charges already-unlocked contacts.
export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => ({}));
  const resultIds: string[] = Array.isArray(body.resultIds) ? body.resultIds.filter((x: unknown) => typeof x === "string").slice(0, MAX_BULK) : [];
  if (resultIds.length === 0) return NextResponse.json({ error: "resultIds is required." }, { status: 400 });

  // Resolve results -> candidates (org-scoped).
  const { data: results } = await supabaseAdmin
    .from("sourcing_run_results").select("id, external_candidate_id").eq("org_id", org.id).in("id", resultIds);
  const candIds = [...new Set((results ?? []).map((r) => r.external_candidate_id).filter(Boolean) as string[])];
  const { data: cands } = await supabaseAdmin
    .from("sourcing_external_candidates")
    .select("id, provider_key, provider_record_id, linkedin_url, full_name, suppressed, profile_unlocked, emails, phones, raw")
    .eq("org_id", org.id).in("id", candIds);
  const candidates = (cands ?? []) as CandidateRow[];

  const costs = await getCreditCosts(org.id);
  const providers = await getProvidersForOrg(org.id);
  const { verifier, apiKey: verifyKey } = getEmailVerifier();

  // Candidates that actually need work (not suppressed, not already fully unlocked).
  const todo = candidates.filter((c) => !c.suppressed && !(c.emails.length > 0 && c.phones.length > 0 && c.profile_unlocked));
  const discount = bundleDiscount(todo.length);

  const summary = { unlocked: 0, no_data: 0, do_not_contact: 0, already: 0, credits_charged: 0 };
  const unlockedIds: string[] = []; // for CRM sync in after()

  for (const c of candidates) {
    if (c.suppressed) { summary.do_not_contact++; continue; }
    const hadEmail = c.emails.length > 0;
    const hadPhone = c.phones.length > 0;
    if (hadEmail && hadPhone && c.profile_unlocked) { summary.already++; continue; }

    const resolved = providers.find((p) => p.provider.key === c.provider_key) ?? providers[0];
    const revealChannel = async (kind: "email" | "phone"): Promise<string | null> => {
      const cached = fromCache(c.raw, kind);
      if (cached) return cached;
      if (!resolved?.provider.revealContact) return null;
      try {
        const r: RevealResult = await resolved.provider.revealContact(
          { providerRecordId: c.provider_record_id, linkedinUrl: c.linkedin_url }, kind, { apiKey: resolved.apiKey, timeoutMs: 15000 });
        return r.found && r.value ? r.value : null;
      } catch { return null; }
    };

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { updated_at: now, profile_unlocked: true, enriched_at: now };
    let gotEmail = hadEmail, gotPhone = hadPhone;
    let emailValue: string | null = null, emailVerification: EmailVerificationStatus | undefined;

    if (!hadEmail) {
      const value = await revealChannel("email");
      if (value) {
        emailVerification = (await verifier.verify(value, { apiKey: verifyKey, timeoutMs: 10000 })).status;
        if (emailVerification !== "invalid") {
          // Do-Not-Contact: never unlock a suppressed address.
          if (await isEmailSuppressed(org.id, value)) {
            await supabaseAdmin.from("sourcing_external_candidates").update({ suppressed: true, updated_at: now }).eq("id", c.id).eq("org_id", org.id);
            summary.do_not_contact++; continue;
          }
          emailValue = value;
          update.emails = [{ value, verification_status: emailVerification, revealed_at: now }];
          update.has_email = true; gotEmail = true;
        }
      }
    }
    if (!hadPhone) {
      const value = await revealChannel("phone");
      if (value) { update.phones = [{ value, revealed_at: now }]; update.has_phone = true; gotPhone = true; }
    }

    if (!gotEmail && !gotPhone) { summary.no_data++; continue; }

    // Discounted, progressive charge for this candidate.
    const fullTarget = gotPhone ? costs.full_contact_unlock : (gotEmail ? costs.reveal_email : 0);
    const target = bundleUnitPrice(fullTarget, todo.length);
    const alreadySpent = (hadEmail ? costs.reveal_email : 0) + (hadPhone ? costs.reveal_phone : 0);
    const charge = Math.max(0, target - alreadySpent);

    const { data: revealRow } = await supabaseAdmin
      .from("sourcing_reveals")
      .insert({ org_id: org.id, external_candidate_id: c.id, revealed_by: userId, reveal_type: "full_contact_unlock", provider_key: c.provider_key, status: "success" })
      .select("id").single();
    const revealId = (revealRow as { id: string } | null)?.id ?? null;

    if (charge > 0 && revealId) {
      const spend = await spendCredits({ orgId: org.id, userId, action: "full_contact_unlock", refType: "reveal", refId: revealId, amountOverride: charge });
      if (!spend.ok) {
        await supabaseAdmin.from("sourcing_reveals").update({ status: "failed", result: { error: spend.dailyCap ? "daily_cap" : "insufficient_credits" } }).eq("id", revealId).eq("org_id", org.id);
        // Ran out — stop here; report what we've done so far.
        const { data: state } = await supabaseAdmin.from("sourcing_credit_balances").select("balance").eq("org_id", org.id).maybeSingle();
        after(async () => {
          for (const cid of unlockedIds) await syncLeadToCrm(org.id, userId, cid).catch((e) => console.error("[sourcing] CRM sync failed", e));
          audit({ org_id: org.id, user_id: userId, action: "sourcing.contact_revealed", resource_type: "sourcing_bulk_unlock", metadata: { ...summary, ran_out: true, discount: discount.label } });
        });
        return NextResponse.json({ data: { ...summary, ran_out: true, balance: (state as { balance?: number } | null)?.balance ?? 0, discount: discount.label } });
      }
      summary.credits_charged += spend.cost;
      await supabaseAdmin.from("sourcing_reveals").update({ credits_spent: spend.cost, ledger_entry_id: spend.ledgerEntryId, result: { email: gotEmail, phone: gotPhone, bundle: todo.length } }).eq("id", revealId).eq("org_id", org.id);
    } else if (revealId) {
      await supabaseAdmin.from("sourcing_reveals").update({ credits_spent: 0, result: { email: gotEmail, phone: gotPhone, already_covered: true } }).eq("id", revealId).eq("org_id", org.id);
    }

    await supabaseAdmin.from("sourcing_external_candidates").update(update).eq("id", c.id).eq("org_id", org.id);
    summary.unlocked++;
    if (gotEmail) unlockedIds.push(c.id);
  }

  const { data: state } = await supabaseAdmin.from("sourcing_credit_balances").select("balance").eq("org_id", org.id).maybeSingle();
  after(async () => {
    for (const cid of unlockedIds) await syncLeadToCrm(org.id, userId, cid).catch((e) => console.error("[sourcing] CRM sync failed", e));
    audit({ org_id: org.id, user_id: userId, action: "sourcing.contact_revealed", resource_type: "sourcing_bulk_unlock", metadata: { ...summary, discount: discount.label } });
  });
  return NextResponse.json({ data: { ...summary, balance: (state as { balance?: number } | null)?.balance ?? 0, discount: discount.label } });
}
