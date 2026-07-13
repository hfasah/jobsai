import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";
import { getProvidersForOrg, getEmailVerifier } from "@/lib/sourcing/registry";
import { spendCredits, refundCredits, ensureMonthlyGrant } from "@/lib/sourcing/credits";
import { loadInternalIndex, dedupeVerdict } from "@/lib/sourcing/dedupe";
import { normEmail } from "@/lib/sourcing/normalize";
import { isEmailSuppressed } from "@/lib/outreach/suppression";
import type { CreditAction, EmailVerificationStatus, ExternalCandidate, RevealResult } from "@/lib/sourcing/types";

export const maxDuration = 30;

type RevealType = "profile" | "email" | "phone";
const CREDIT_ACTION: Record<RevealType, CreditAction> = {
  profile: "unlock_profile",
  email: "reveal_email",
  phone: "reveal_phone",
};

interface StoredContact {
  value: string;
  type?: string;
  verification_status?: EmailVerificationStatus;
  revealed_at: string;
}

interface CandidateRow {
  id: string;
  provider_key: string;
  provider_record_id: string;
  linkedin_url: string | null;
  full_name: string | null;
  suppressed: boolean;
  profile_unlocked: boolean;
  emails: StoredContact[];
  phones: StoredContact[];
  raw: Record<string, unknown> | null;
}

// Serve from the cached enrich payload when possible — the org still pays
// credits (that's the product), but we don't re-bill the provider.
function fromCache(candidate: CandidateRow, type: "email" | "phone"): RevealResult | null {
  const raw = candidate.raw as {
    work_email?: string;
    recommended_personal_email?: string;
    emails?: ({ address?: string } | string)[];
    mobile_phone?: string;
    phone_numbers?: string[];
  } | null;
  if (!raw) return null;
  if (type === "email") {
    const value =
      raw.work_email ??
      raw.recommended_personal_email ??
      (typeof raw.emails?.[0] === "string" ? (raw.emails[0] as string) : (raw.emails?.[0] as { address?: string } | undefined)?.address) ??
      null;
    return value ? { found: true, value } : { found: false, value: null };
  }
  const phone = raw.mobile_phone ?? raw.phone_numbers?.[0] ?? null;
  return phone ? { found: true, value: phone } : { found: false, value: null };
}

// POST /api/enterprise/sourcing/results/[id]/reveal  { type: profile|email|phone }
// [id] is a sourcing_run_results id.
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
  await ensureMonthlyGrant(org.id); // free trial + monthly credits (idempotent)

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const type: RevealType = ["profile", "email", "phone"].includes(body.type) ? body.type : "email";

  // Resolve result -> external candidate, org-scoped at every step.
  const { data: result } = await supabaseAdmin
    .from("sourcing_run_results")
    .select("id, external_candidate_id, dedup_status")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  const resultRow = result as { id: string; external_candidate_id: string | null; dedup_status: string } | null;
  if (!resultRow?.external_candidate_id) {
    return NextResponse.json({ error: "Result not found or not an external candidate." }, { status: 404 });
  }

  const { data: cand } = await supabaseAdmin
    .from("sourcing_external_candidates")
    .select("id, provider_key, provider_record_id, linkedin_url, full_name, suppressed, profile_unlocked, emails, phones, raw")
    .eq("id", resultRow.external_candidate_id)
    .eq("org_id", org.id)
    .maybeSingle();
  const candidate = cand as CandidateRow | null;
  if (!candidate) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  if (candidate.suppressed) {
    return NextResponse.json({ error: "This candidate is on your suppression list." }, { status: 403 });
  }

  // Idempotency: already revealed/unlocked -> return what we have, no charge.
  if (type === "profile" && candidate.profile_unlocked) {
    return NextResponse.json({ data: { already: true, emails: candidate.emails, phones: candidate.phones } });
  }
  if (type === "email" && candidate.emails.length > 0) {
    return NextResponse.json({ data: { already: true, value: candidate.emails[0].value, emails: candidate.emails } });
  }
  if (type === "phone" && candidate.phones.length > 0) {
    return NextResponse.json({ data: { already: true, value: candidate.phones[0].value, phones: candidate.phones } });
  }

  // Create the reveal record first; every spend references it.
  const { data: revealRow } = await supabaseAdmin
    .from("sourcing_reveals")
    .insert({
      org_id: org.id,
      external_candidate_id: candidate.id,
      revealed_by: userId,
      reveal_type: type,
      provider_key: candidate.provider_key,
      status: "success",
    })
    .select("id")
    .single();
  const revealId = (revealRow as { id: string } | null)?.id;
  if (!revealId) return NextResponse.json({ error: "Could not start reveal." }, { status: 500 });

  const spend = await spendCredits({ orgId: org.id, userId, action: CREDIT_ACTION[type], refType: "reveal", refId: revealId });
  if (!spend.ok) {
    await supabaseAdmin.from("sourcing_reveals").update({ status: "failed", result: { error: spend.dailyCap ? "daily_cap" : "insufficient_credits" } }).eq("id", revealId).eq("org_id", org.id);
    return NextResponse.json(
      {
        error: spend.dailyCap ? "Daily sourcing-credit cap reached." : "Not enough sourcing credits.",
        credits: true,
        balance: spend.balance,
        cost: spend.cost,
        daily_cap: spend.dailyCap ?? false,
      },
      { status: 402 },
    );
  }

  const fail = async (status: "failed" | "no_data", error?: string) => {
    await refundCredits({ orgId: org.id, userId, amount: spend.cost, refType: "reveal", refId: revealId });
    await supabaseAdmin
      .from("sourcing_reveals")
      .update({ status: status === "no_data" ? "no_data" : "failed", credits_spent: 0, ledger_entry_id: spend.ledgerEntryId, result: { error: error ?? status } })
      .eq("id", revealId)
      .eq("org_id", org.id);
  };

  // Resolve the provider and perform the reveal (cache first).
  let reveal: RevealResult | null = type === "profile" ? null : fromCache(candidate, type);
  let enriched: ExternalCandidate | null = null;
  if (!reveal?.found) {
    const providers = await getProvidersForOrg(org.id);
    const resolved = providers.find((p) => p.provider.key === candidate.provider_key) ?? providers[0];
    if (!resolved?.provider.revealContact) {
      await fail("failed", "provider_unavailable");
      return NextResponse.json({ error: "No reveal-capable provider configured." }, { status: 502 });
    }
    try {
      reveal = await resolved.provider.revealContact(
        { providerRecordId: candidate.provider_record_id, linkedinUrl: candidate.linkedin_url },
        type === "phone" ? "phone" : "email",
        { apiKey: resolved.apiKey, timeoutMs: 15000 },
      );
      enriched = reveal.enriched ?? null;
    } catch (e) {
      console.error("[sourcing] reveal provider error", e);
      await fail("failed", "provider_error");
      return NextResponse.json({ error: "Provider error — credits refunded." }, { status: 502 });
    }
  }

  if (!reveal?.found || !reveal.value) {
    await fail("no_data");
    return NextResponse.json({ error: "No contact data found — credits refunded.", no_data: true }, { status: 404 });
  }

  // Do-Not-Contact: if the revealed email is on the org's suppression list, we
  // must not monetize it — refund, flag the candidate suppressed, don't store.
  if ((type === "email" || (type === "profile" && normEmail(reveal.value))) && await isEmailSuppressed(org.id, reveal.value)) {
    await refundCredits({ orgId: org.id, userId, amount: spend.cost, refType: "reveal", refId: revealId });
    await supabaseAdmin.from("sourcing_external_candidates").update({ suppressed: true, updated_at: new Date().toISOString() }).eq("id", candidate.id).eq("org_id", org.id);
    await supabaseAdmin.from("sourcing_reveals").update({ status: "refunded", credits_spent: 0, ledger_entry_id: spend.ledgerEntryId, result: { do_not_contact: true } }).eq("id", revealId).eq("org_id", org.id);
    return NextResponse.json({ error: "This person is on your Do-Not-Contact list — not revealed, no credits charged.", do_not_contact: true }, { status: 409 });
  }

  // Verify revealed emails before storing.
  const now = new Date().toISOString();
  let verification: EmailVerificationStatus | undefined;
  const update: Record<string, unknown> = { updated_at: now, profile_unlocked: true, enriched_at: now };

  if (type === "email" || (type === "profile" && normEmail(reveal.value))) {
    const { verifier, apiKey } = getEmailVerifier();
    verification = (await verifier.verify(reveal.value, { apiKey, timeoutMs: 10000 })).status;
    const emails: StoredContact[] = [
      { value: reveal.value, verification_status: verification, revealed_at: now },
      ...(reveal.extra ?? []).map((value) => ({ value, revealed_at: now })),
    ];
    update.emails = emails;
    update.has_email = true;
  } else if (type === "phone") {
    update.phones = [
      { value: reveal.value, revealed_at: now },
      ...(reveal.extra ?? []).map((value) => ({ value, revealed_at: now })),
    ] satisfies StoredContact[];
    update.has_phone = true;
  }

  // Fold in the full enrich payload when the provider returned one.
  if (enriched) {
    update.raw = enriched.raw ?? candidate.raw;
    if (enriched.skills?.length) update.skills = enriched.skills;
    if (enriched.experience_years != null) update.experience_years = enriched.experience_years;
    if (enriched.job_title) update.job_title = enriched.job_title;
    if (enriched.company) update.company = enriched.company;
  }

  await supabaseAdmin
    .from("sourcing_external_candidates")
    .update(update)
    .eq("id", candidate.id)
    .eq("org_id", org.id);

  await supabaseAdmin
    .from("sourcing_reveals")
    .update({
      credits_spent: spend.cost,
      ledger_entry_id: spend.ledgerEntryId,
      status: "success",
      result: { value: reveal.value, verification_status: verification ?? null, confidence: reveal.confidence ?? null },
    })
    .eq("id", revealId)
    .eq("org_id", org.id);

  after(async () => {
    // A freshly revealed email may match an existing internal record — refresh
    // the dedup verdict on this run result and warn the UI next load.
    if (type !== "phone") {
      try {
        const revealedEmails = [reveal!.value!, ...(reveal!.extra ?? [])];
        const minimal: ExternalCandidate = {
          provider_key: candidate.provider_key,
          provider_record_id: candidate.provider_record_id,
          source_type: "provider_api",
          permitted_use: null,
          confidence: null,
          full_name: candidate.full_name,
          first_name: null, last_name: null, job_title: null, company: null,
          location_country: null, location_locality: null,
          skills: [], experience_years: null, industries: [], education: [], languages: [],
          linkedin_url: candidate.linkedin_url, github_url: null, portfolio_url: null,
          has_email: true, has_phone: null,
        };
        const index = await loadInternalIndex(org.id, [{ candidate: minimal, externalId: candidate.id, revealedEmails }]);
        const verdict = dedupeVerdict(minimal, index, { externalId: candidate.id, revealedEmails });
        if (verdict.status !== "new" && verdict.status !== resultRow.dedup_status) {
          await supabaseAdmin
            .from("sourcing_run_results")
            .update({ dedup_status: verdict.status, dedup_matches: verdict.matches })
            .eq("id", resultRow.id)
            .eq("org_id", org.id);
        }
      } catch (e) {
        console.error("[sourcing] post-reveal dedup failed", e);
      }
    }
    audit({
      org_id: org.id,
      user_id: userId,
      action: "sourcing.contact_revealed",
      resource_type: "sourcing_external_candidate",
      resource_id: candidate.id,
      metadata: { reveal_type: type, provider: candidate.provider_key, credits: spend.cost, verification: verification ?? null },
    });
  });

  return NextResponse.json({
    data: {
      value: reveal.value,
      extra: reveal.extra ?? [],
      verification_status: verification ?? null,
      credits_charged: spend.cost,
      balance: spend.balance,
    },
  });
}
