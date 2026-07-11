import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";
import { getProvidersForOrg } from "@/lib/sourcing/registry";
import { spendCredits, refundCredits } from "@/lib/sourcing/credits";

export const maxDuration = 30;

// POST /api/enterprise/sourcing/results/[id]/enrich — refresh the full
// profile from the provider (skills, role, education…). 3 credits, refunded
// when the provider has nothing. Contact values are NOT exposed here — that
// stays behind /reveal.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_reveal_contacts");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await ctx.params;
  const { data: result } = await supabaseAdmin
    .from("sourcing_run_results")
    .select("id, external_candidate_id")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();
  const resultRow = result as { id: string; external_candidate_id: string | null } | null;
  if (!resultRow?.external_candidate_id) {
    return NextResponse.json({ error: "Result not found or not an external candidate." }, { status: 404 });
  }

  const { data: cand } = await supabaseAdmin
    .from("sourcing_external_candidates")
    .select("id, provider_key, provider_record_id, linkedin_url, suppressed")
    .eq("id", resultRow.external_candidate_id)
    .eq("org_id", org.id)
    .maybeSingle();
  const candidate = cand as { id: string; provider_key: string; provider_record_id: string; linkedin_url: string | null; suppressed: boolean } | null;
  if (!candidate) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });
  if (candidate.suppressed) return NextResponse.json({ error: "This candidate is on your suppression list." }, { status: 403 });

  const { data: revealRow } = await supabaseAdmin
    .from("sourcing_reveals")
    .insert({ org_id: org.id, external_candidate_id: candidate.id, revealed_by: userId, reveal_type: "enrich", provider_key: candidate.provider_key, status: "success" })
    .select("id")
    .single();
  const revealId = (revealRow as { id: string } | null)?.id;
  if (!revealId) return NextResponse.json({ error: "Could not start enrichment." }, { status: 500 });

  const spend = await spendCredits({ orgId: org.id, userId, action: "enrich", refType: "reveal", refId: revealId });
  if (!spend.ok) {
    await supabaseAdmin.from("sourcing_reveals").update({ status: "failed", result: { error: "insufficient_credits" } }).eq("id", revealId).eq("org_id", org.id);
    return NextResponse.json({ error: "Not enough sourcing credits.", credits: true, balance: spend.balance, cost: spend.cost }, { status: 402 });
  }

  const refundAndMark = async (status: "failed" | "no_data", error: string) => {
    await refundCredits({ orgId: org.id, userId, amount: spend.cost, refType: "reveal", refId: revealId });
    await supabaseAdmin
      .from("sourcing_reveals")
      .update({ status, credits_spent: 0, ledger_entry_id: spend.ledgerEntryId, result: { error } })
      .eq("id", revealId)
      .eq("org_id", org.id);
  };

  const providers = await getProvidersForOrg(org.id);
  const resolved = providers.find((p) => p.provider.key === candidate.provider_key) ?? providers[0];
  if (!resolved?.provider.enrichCandidate) {
    await refundAndMark("failed", "provider_unavailable");
    return NextResponse.json({ error: "No enrichment-capable provider configured." }, { status: 502 });
  }

  try {
    const enriched = await resolved.provider.enrichCandidate(
      { providerRecordId: candidate.provider_record_id, linkedinUrl: candidate.linkedin_url },
      { apiKey: resolved.apiKey, timeoutMs: 15000 },
    );
    if (!enriched) {
      await refundAndMark("no_data", "no_data");
      return NextResponse.json({ error: "Provider had no additional data — credits refunded.", no_data: true }, { status: 404 });
    }

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("sourcing_external_candidates")
      .update({
        full_name: enriched.full_name ?? undefined,
        job_title: enriched.job_title ?? undefined,
        company: enriched.company ?? undefined,
        location_country: enriched.location_country ?? undefined,
        location_locality: enriched.location_locality ?? undefined,
        skills: enriched.skills.length ? enriched.skills : undefined,
        experience_years: enriched.experience_years ?? undefined,
        industries: enriched.industries.length ? enriched.industries : undefined,
        education: enriched.education.length ? enriched.education : undefined,
        languages: enriched.languages.length ? enriched.languages : undefined,
        github_url: enriched.github_url ?? undefined,
        has_email: enriched.has_email ?? undefined,
        has_phone: enriched.has_phone ?? undefined,
        confidence: enriched.confidence ?? undefined,
        raw: enriched.raw ?? undefined,
        enriched_at: now,
        updated_at: now,
      })
      .eq("id", candidate.id)
      .eq("org_id", org.id);

    await supabaseAdmin
      .from("sourcing_reveals")
      .update({ credits_spent: spend.cost, ledger_entry_id: spend.ledgerEntryId, status: "success", result: { enriched: true } })
      .eq("id", revealId)
      .eq("org_id", org.id);

    after(() => {
      audit({
        org_id: org.id,
        user_id: userId,
        action: "sourcing.profile_enriched",
        resource_type: "sourcing_external_candidate",
        resource_id: candidate.id,
        metadata: { provider: candidate.provider_key, credits: spend.cost },
      });
    });

    return NextResponse.json({ data: { enriched: true, credits_charged: spend.cost, balance: spend.balance } });
  } catch (e) {
    console.error("[sourcing] enrich provider error", e);
    await refundAndMark("failed", "provider_error");
    return NextResponse.json({ error: "Provider error — credits refunded." }, { status: 502 });
  }
}
