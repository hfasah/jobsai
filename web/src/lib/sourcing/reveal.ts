// Shared single-candidate email reveal — used by the bulk reveal route so
// selecting 100 leads and revealing them is one action. Mirrors the email path
// of results/[id]/reveal (credits up-front, refund on no_data, verify before
// store). SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";
import { spendCredits, refundCredits } from "./credits";
import { getEmailVerifier, type ResolvedProvider } from "./registry";
import type { EmailVerificationStatus, ExternalCandidate, RevealResult } from "./types";

export type BulkRevealStatus = "revealed" | "already" | "no_data" | "suppressed" | "error" | "insufficient";

export interface BulkRevealOutcome {
  resultId: string;
  status: BulkRevealStatus;
  email?: string | null;
  verification?: EmailVerificationStatus | null;
  creditsCharged?: number;
}

interface StoredContact { value: string; type?: string; verification_status?: EmailVerificationStatus; revealed_at: string }
interface CandidateRow {
  id: string; provider_key: string; provider_record_id: string; linkedin_url: string | null;
  full_name: string | null; suppressed: boolean; emails: StoredContact[]; raw: Record<string, unknown> | null;
}

// Serve the email from the cached enrich payload when present (org still pays
// credits — that's the product — but we don't re-bill the provider).
function emailFromCache(raw: CandidateRow["raw"]): string | null {
  const r = raw as { work_email?: string; recommended_personal_email?: string; emails?: ({ address?: string } | string)[] } | null;
  if (!r) return null;
  const first = r.emails?.[0];
  return r.work_email ?? r.recommended_personal_email ?? (typeof first === "string" ? first : first?.address) ?? null;
}

export async function revealEmailForResult(args: {
  orgId: string;
  userId: string;
  resultId: string;
  providers: ResolvedProvider[];
  verifier: ReturnType<typeof getEmailVerifier>;
}): Promise<BulkRevealOutcome> {
  const { orgId, userId, resultId, providers, verifier } = args;

  const { data: result } = await supabaseAdmin
    .from("sourcing_run_results")
    .select("id, external_candidate_id")
    .eq("id", resultId).eq("org_id", orgId).maybeSingle();
  const ecId = (result as { external_candidate_id: string | null } | null)?.external_candidate_id;
  if (!ecId) return { resultId, status: "error" };

  const { data: cand } = await supabaseAdmin
    .from("sourcing_external_candidates")
    .select("id, provider_key, provider_record_id, linkedin_url, full_name, suppressed, emails, raw")
    .eq("id", ecId).eq("org_id", orgId).maybeSingle();
  const candidate = cand as CandidateRow | null;
  if (!candidate) return { resultId, status: "error" };
  if (candidate.suppressed) return { resultId, status: "suppressed" };
  if (candidate.emails.length > 0) return { resultId, status: "already", email: candidate.emails[0].value };

  const { data: revealRow } = await supabaseAdmin
    .from("sourcing_reveals")
    .insert({ org_id: orgId, external_candidate_id: candidate.id, revealed_by: userId, reveal_type: "email", provider_key: candidate.provider_key, status: "success" })
    .select("id").single();
  const revealId = (revealRow as { id: string } | null)?.id;
  if (!revealId) return { resultId, status: "error" };

  const spend = await spendCredits({ orgId, userId, action: "reveal_email", refType: "reveal", refId: revealId });
  if (!spend.ok) {
    await supabaseAdmin.from("sourcing_reveals").update({ status: "failed", result: { error: "insufficient_credits" } }).eq("id", revealId).eq("org_id", orgId);
    return { resultId, status: "insufficient" };
  }

  const refund = async (status: "failed" | "no_data") => {
    await refundCredits({ orgId, userId, amount: spend.cost, refType: "reveal", refId: revealId });
    await supabaseAdmin.from("sourcing_reveals").update({ status, credits_spent: 0, ledger_entry_id: spend.ledgerEntryId }).eq("id", revealId).eq("org_id", orgId);
  };

  // Cache first, then the provider.
  let reveal: RevealResult | null = null;
  let enriched: ExternalCandidate | null = null;
  const cached = emailFromCache(candidate.raw);
  if (cached) reveal = { found: true, value: cached };
  if (!reveal?.found) {
    const resolved = providers.find((p) => p.provider.key === candidate.provider_key) ?? providers[0];
    if (!resolved?.provider.revealContact) { await refund("failed"); return { resultId, status: "error" }; }
    try {
      reveal = await resolved.provider.revealContact(
        { providerRecordId: candidate.provider_record_id, linkedinUrl: candidate.linkedin_url },
        "email",
        { apiKey: resolved.apiKey, timeoutMs: 15000 },
      );
      enriched = reveal.enriched ?? null;
    } catch {
      await refund("failed");
      return { resultId, status: "error" };
    }
  }
  if (!reveal?.found || !reveal.value) { await refund("no_data"); return { resultId, status: "no_data" }; }

  const now = new Date().toISOString();
  const verification = (await verifier.verifier.verify(reveal.value, { apiKey: verifier.apiKey, timeoutMs: 10000 })).status;
  const emails: StoredContact[] = [
    { value: reveal.value, verification_status: verification, revealed_at: now },
    ...(reveal.extra ?? []).map((value) => ({ value, revealed_at: now })),
  ];
  const update: Record<string, unknown> = { updated_at: now, profile_unlocked: true, enriched_at: now, emails, has_email: true };
  if (enriched) {
    update.raw = enriched.raw ?? candidate.raw;
    if (enriched.skills?.length) update.skills = enriched.skills;
    if (enriched.experience_years != null) update.experience_years = enriched.experience_years;
    if (enriched.job_title) update.job_title = enriched.job_title;
    if (enriched.company) update.company = enriched.company;
  }
  await supabaseAdmin.from("sourcing_external_candidates").update(update).eq("id", candidate.id).eq("org_id", orgId);
  await supabaseAdmin.from("sourcing_reveals").update({
    credits_spent: spend.cost, ledger_entry_id: spend.ledgerEntryId, status: "success",
    result: { value: reveal.value, verification_status: verification ?? null, confidence: reveal.confidence ?? null },
  }).eq("id", revealId).eq("org_id", orgId);

  return { resultId, status: "revealed", email: reveal.value, verification: verification ?? null, creditsCharged: spend.cost };
}
