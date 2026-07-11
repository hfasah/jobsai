import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { recordUsage } from "@/lib/llm-usage";
import { sanitizeFilters, hasSearchableCriteria } from "@/lib/sourcing/filters";
import { getProvidersForOrg } from "@/lib/sourcing/registry";
import { mergeCandidates } from "@/lib/sourcing/merge";
import { computeMatchScore, normalizeWeights } from "@/lib/sourcing/score";
import { loadInternalIndex, dedupeVerdict } from "@/lib/sourcing/dedupe";
import { ensureMonthlyGrant, spendCredits, refundCredits } from "@/lib/sourcing/credits";
import { internalRediscoverySearch, type InternalSearchResult } from "@/lib/sourcing/internal-search";
import { normEmail, linkedinHandle } from "@/lib/sourcing/normalize";
import type { ExternalCandidate, ScoreWeights, SourcingMode } from "@/lib/sourcing/types";

export const maxDuration = 60;

const PROVIDER_TIMEOUT_MS = 20000;
// Default records fetched per provider per search. Higher = more leads shown
// (competitive with other tools) but PDL bills per record, so it's an
// acquisition cost while search stays free. Admin-tunable per org via the
// provider's settings.search_limit (clamped 10–100).
const DEFAULT_PER_PROVIDER_LIMIT = 50;
function clampLimit(n: unknown): number {
  const v = typeof n === "number" ? Math.floor(n) : NaN;
  return Number.isFinite(v) ? Math.max(10, Math.min(100, v)) : DEFAULT_PER_PROVIDER_LIMIT;
}

interface SuppressionKeys {
  emails: Set<string>;
  linkedin: Set<string>;
  providerRecords: Set<string>; // `${provider_key}:${provider_record_id}`
}

async function loadSuppressions(orgId: string): Promise<SuppressionKeys> {
  const { data } = await supabaseAdmin
    .from("sourcing_suppressions")
    .select("email, linkedin_url, provider_key, provider_record_id")
    .eq("org_id", orgId);
  const keys: SuppressionKeys = { emails: new Set(), linkedin: new Set(), providerRecords: new Set() };
  for (const row of (data ?? []) as { email: string | null; linkedin_url: string | null; provider_key: string | null; provider_record_id: string | null }[]) {
    const e = normEmail(row.email);
    if (e) keys.emails.add(e);
    const h = linkedinHandle(row.linkedin_url);
    if (h) keys.linkedin.add(h);
    if (row.provider_key && row.provider_record_id) keys.providerRecords.add(`${row.provider_key}:${row.provider_record_id}`);
  }
  return keys;
}

function isSuppressed(c: ExternalCandidate, s: SuppressionKeys): boolean {
  if (s.providerRecords.has(`${c.provider_key}:${c.provider_record_id}`)) return true;
  const h = linkedinHandle(c.linkedin_url);
  if (h && s.linkedin.has(h)) return true;
  return false;
}

// Fill fit_reason for the top external results in one batched fast-tier call.
async function fillFitReasons(args: {
  orgId: string;
  userId: string;
  runId: string;
  query: string;
  results: { id: string; name: string | null; title: string | null; company: string | null; skills: string[] }[];
}) {
  if (args.results.length === 0) return;
  const block = args.results
    .map((r, i) => `[${i}] ${r.name ?? "Unknown"} — ${r.title ?? "?"} at ${r.company ?? "?"} — skills: ${r.skills.slice(0, 8).join(", ")}`)
    .join("\n");
  try {
    const response = await getAIClient(AI_TIERS.fast.provider).chat.completions.create({
      model: AI_TIERS.fast.model,
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 900,
      messages: [
        {
          role: "user",
          content: `A recruiter searched for: "${args.query}"\n\nFor each candidate below, write ONE short sentence on why they fit (factual, based only on the listed title/company/skills — never speculate about job-seeking status or personal traits).\n\n${block}\n\nReturn JSON: {"reasons": [{"index": 0, "fit_reason": "..."}, ...]}`,
        },
      ],
    });
    recordUsage({ orgId: args.orgId, userId: args.userId, feature: "sourcing_fit_reason", model: AI_TIERS.fast.model, usage: response.usage });
    const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}") as { reasons?: { index: number; fit_reason: string }[] };
    for (const r of parsed.reasons ?? []) {
      const target = args.results[r.index];
      if (!target || typeof r.fit_reason !== "string") continue;
      await supabaseAdmin
        .from("sourcing_run_results")
        .update({ fit_reason: r.fit_reason.slice(0, 300) })
        .eq("id", target.id)
        .eq("org_id", args.orgId);
    }
  } catch (e) {
    console.error("[sourcing] fit_reason fill failed", e);
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const mode: SourcingMode = ["external", "internal", "combined"].includes(body.mode) ? body.mode : "combined";
  const query: string = typeof body.query === "string" ? body.query.slice(0, 1000) : "";
  const filters = sanitizeFilters(body.filters);
  const searchId: string | null = typeof body.search_id === "string" ? body.search_id : null;

  if (mode !== "internal") {
    const denied = await requirePermission(userId, "can_source_external");
    if (denied) return denied;
    if (!hasSearchableCriteria(filters)) {
      return NextResponse.json({ error: "Add at least one search criterion (title, skill, location…)." }, { status: 400 });
    }
  }
  if (mode !== "external") {
    const gateInternal = await requireFeature(userId, "ai_sourcing");
    if (gateInternal) return gateInternal;
    if (mode === "internal" && !query.trim()) {
      return NextResponse.json({ error: "query is required for internal search." }, { status: 400 });
    }
  }

  // Per-org default weights unless the caller supplies overrides.
  const { data: settings } = await supabaseAdmin
    .from("sourcing_org_settings")
    .select("default_weights")
    .eq("org_id", org.id)
    .maybeSingle();
  const weights: ScoreWeights = normalizeWeights({
    ...((settings as { default_weights?: Partial<ScoreWeights> } | null)?.default_weights ?? {}),
    ...(body.weights && typeof body.weights === "object" ? body.weights : {}),
  });

  await ensureMonthlyGrant(org.id);

  const started = Date.now();
  const providers = mode === "internal" ? [] : await getProvidersForOrg(org.id);

  // Create the run first — every spend references it.
  const { data: runRow, error: runError } = await supabaseAdmin
    .from("sourcing_search_runs")
    .insert({
      org_id: org.id,
      search_id: searchId,
      created_by: userId,
      mode,
      query_text: query || null,
      filters,
      weights,
      providers: providers.map((p) => p.provider.key),
      status: "running",
    })
    .select("id")
    .single();
  if (runError || !runRow) {
    return NextResponse.json({ error: "Could not start search." }, { status: 500 });
  }
  const runId = (runRow as { id: string }).id;

  // External searches cost 1 credit, spent up-front and auto-refunded when the
  // search yields nothing (or every provider fails).
  let creditsCharged = 0;
  if (mode !== "internal") {
    const spend = await spendCredits({ orgId: org.id, userId, action: "search", refType: "run", refId: runId });
    if (!spend.ok) {
      await supabaseAdmin.from("sourcing_search_runs").update({ status: "failed", error: spend.dailyCap ? "daily_cap" : "insufficient_credits" }).eq("id", runId).eq("org_id", org.id);
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
    creditsCharged = spend.cost;
  }

  // Fan out: external providers + internal leg in parallel.
  const externalPromises = providers.map((p) =>
    p.provider.searchCandidates(filters, {
      apiKey: p.apiKey,
      timeoutMs: PROVIDER_TIMEOUT_MS,
      limit: clampLimit((p.settings as { search_limit?: number } | undefined)?.search_limit),
    }),
  );
  const internalPromise: Promise<InternalSearchResult> | null =
    mode !== "external" && query.trim()
      ? internalRediscoverySearch({ orgId: org.id, userId, query, jobId: body.job_id ?? null, limit: 20 })
      : null;

  const [externalSettled, internalResult, suppressions] = await Promise.all([
    Promise.allSettled(externalPromises),
    internalPromise ?? Promise.resolve(null),
    loadSuppressions(org.id),
  ]);

  const providerErrors: string[] = [];
  let rawExternal: ExternalCandidate[] = [];
  for (let i = 0; i < externalSettled.length; i++) {
    const settled = externalSettled[i];
    if (settled.status === "fulfilled") {
      rawExternal.push(...settled.value.candidates);
      if (settled.value.error) providerErrors.push(`${providers[i].provider.key}: ${settled.value.error}`);
    } else {
      providerErrors.push(`${providers[i].provider.key}: ${String(settled.reason).slice(0, 200)}`);
      console.error("[sourcing] provider failed", providers[i].provider.key, settled.reason);
    }
  }

  // Merge cross-provider duplicates, drop suppressed people.
  rawExternal = mergeCandidates(rawExternal).filter((c) => !isSuppressed(c, suppressions));

  // Upsert into the org's external-candidate cache. Contact fields and
  // unlock state are never overwritten by a fresh search.
  const externalIds = new Map<string, string>(); // provider_record_id -> row id
  for (const c of rawExternal) {
    const { data: upserted } = await supabaseAdmin
      .from("sourcing_external_candidates")
      .upsert(
        {
          org_id: org.id,
          provider_key: c.provider_key,
          provider_record_id: c.provider_record_id,
          source_type: c.source_type,
          permitted_use: c.permitted_use,
          confidence: c.confidence,
          full_name: c.full_name,
          first_name: c.first_name,
          last_name: c.last_name,
          job_title: c.job_title,
          company: c.company,
          location_country: c.location_country,
          location_locality: c.location_locality,
          skills: c.skills,
          experience_years: c.experience_years,
          industries: c.industries,
          education: c.education,
          languages: c.languages,
          linkedin_url: c.linkedin_url,
          github_url: c.github_url,
          portfolio_url: c.portfolio_url,
          has_email: c.has_email,
          has_phone: c.has_phone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id,provider_key,provider_record_id" },
      )
      .select("id, suppressed")
      .single();
    const row = upserted as { id: string; suppressed: boolean } | null;
    if (row && !row.suppressed) externalIds.set(c.provider_record_id, row.id);
  }
  const external = rawExternal.filter((c) => externalIds.has(c.provider_record_id));

  // Dedup against the org's internal world.
  const index = await loadInternalIndex(
    org.id,
    external.map((candidate) => ({ candidate, externalId: externalIds.get(candidate.provider_record_id) })),
  );

  // Score + build result rows.
  const resultRows: Record<string, unknown>[] = [];
  const scored = external
    .map((candidate) => {
      const { score, breakdown } = computeMatchScore(candidate, filters, weights);
      const verdict = dedupeVerdict(candidate, index, { externalId: externalIds.get(candidate.provider_record_id) });
      return { candidate, score, breakdown, verdict };
    })
    .sort((a, b) => b.score - a.score);

  scored.forEach((s, i) => {
    resultRows.push({
      org_id: org.id,
      run_id: runId,
      origin: "external",
      external_candidate_id: externalIds.get(s.candidate.provider_record_id),
      match_score: s.score,
      score_breakdown: s.breakdown,
      dedup_status: s.verdict.status,
      dedup_matches: s.verdict.matches,
      position: i,
    });
  });

  const internalCount = internalResult?.candidates.length ?? 0;
  internalResult?.candidates.forEach((c, i) => {
    resultRows.push({
      org_id: org.id,
      run_id: runId,
      origin: c.source === "application" ? "internal_application" : "internal_pool",
      internal_ref_id: c.id,
      match_score: c.relevance_score,
      fit_reason: c.fit_reason,
      dedup_status: "existing",
      dedup_matches: [],
      position: scored.length + i,
    });
  });

  let insertedResults: { id: string; external_candidate_id: string | null; position: number }[] = [];
  if (resultRows.length > 0) {
    const { data: inserted } = await supabaseAdmin
      .from("sourcing_run_results")
      .insert(resultRows)
      .select("id, external_candidate_id, position");
    insertedResults = (inserted ?? []) as typeof insertedResults;
  }

  // Refund + finalize when external yielded nothing (or everything failed).
  const externalCount = scored.length;
  const allProvidersFailed = providers.length > 0 && providerErrors.length === providers.length && externalCount === 0;
  if (mode !== "internal" && creditsCharged > 0 && (externalCount === 0 || allProvidersFailed)) {
    await refundCredits({ orgId: org.id, userId, amount: creditsCharged, refType: "run", refId: runId, note: "empty_or_failed" });
    creditsCharged = 0;
  }

  const status = allProvidersFailed ? "failed" : providerErrors.length > 0 ? "partial" : "completed";
  await supabaseAdmin
    .from("sourcing_search_runs")
    .update({
      status,
      result_count: externalCount + internalCount,
      external_count: externalCount,
      internal_count: internalCount,
      credits_charged: creditsCharged,
      error: providerErrors.length ? providerErrors.join("; ").slice(0, 500) : null,
      duration_ms: Date.now() - started,
    })
    .eq("id", runId)
    .eq("org_id", org.id);

  if (searchId) {
    const { data: sRow } = await supabaseAdmin
      .from("sourcing_searches")
      .select("run_count")
      .eq("id", searchId)
      .eq("org_id", org.id)
      .maybeSingle();
    await supabaseAdmin
      .from("sourcing_searches")
      .update({
        last_run_at: new Date().toISOString(),
        run_count: ((sRow as { run_count?: number } | null)?.run_count ?? 0) + 1,
      })
      .eq("id", searchId)
      .eq("org_id", org.id);
  }

  // Post-response: LLM fit reasons for the top external results + audit.
  const byExternalId = new Map(insertedResults.filter((r) => r.external_candidate_id).map((r) => [r.external_candidate_id as string, r.id]));
  const topExternal = scored.slice(0, 20).map((s) => ({
    id: byExternalId.get(externalIds.get(s.candidate.provider_record_id) ?? "") ?? "",
    name: s.candidate.full_name,
    title: s.candidate.job_title,
    company: s.candidate.company,
    skills: s.candidate.skills,
  })).filter((r) => r.id);
  after(async () => {
    await fillFitReasons({ orgId: org.id, userId, runId, query: query || JSON.stringify(filters.titles), results: topExternal });
    audit({
      org_id: org.id,
      user_id: userId,
      action: "sourcing.search_executed",
      resource_type: "sourcing_run",
      resource_id: runId,
      metadata: { mode, external_count: externalCount, internal_count: internalCount, providers: providers.map((p) => p.provider.key), credits: creditsCharged },
    });
  });

  return NextResponse.json({
    data: {
      run_id: runId,
      status,
      mode,
      external_count: externalCount,
      internal_count: internalCount,
      credits_charged: creditsCharged,
      provider_errors: providerErrors,
    },
  });
}
