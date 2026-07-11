// Internal "AI Talent Rediscovery" core — extracted verbatim from
// /api/enterprise/sourcing/search so the Combined mode of Global Sourcing can
// run the same internal leg without HTTP. Behavior-preserving refactor.
// SERVER-ONLY.
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { supabaseAdmin } from "@/lib/supabase";
import { recordUsage } from "@/lib/llm-usage";

export interface InternalCandidateResult {
  id: string;
  source: "application" | "pool";
  name: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  match_score: number;
  applied_for: string;
  stage: string | null;
  ai_summary: string;
  ai_rec: string;
  cover_snippet: string;
  fit_reason: string;
  relevance_score: number;
}

export interface InternalSearchResult {
  candidates: InternalCandidateResult[];
  total_searched: number;
}

export async function internalRediscoverySearch(args: {
  orgId: string;
  userId: string;
  query: string;
  jobId?: string | null;
  limit?: number;
}): Promise<InternalSearchResult> {
  const { orgId, userId, query, jobId } = args;
  const limit = args.limit ?? 20;

  // Fetch job context if provided
  let jobContext = "";
  if (jobId) {
    const { data: job } = await supabaseAdmin
      .from("enterprise_jobs")
      .select("title, description, qualifications, responsibilities")
      .eq("id", jobId)
      .eq("org_id", orgId)
      .maybeSingle();
    if (job) {
      jobContext = `\nTarget job: ${job.title}\nRequirements: ${(job.qualifications ?? "").slice(0, 400)}\nResponsibilities: ${(job.responsibilities ?? "").slice(0, 300)}`;
    }
  }

  // Pull past applicants (up to 300, ranked by score)
  const { data: applications } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id, candidate_name, candidate_email, candidate_phone, linkedin_url, match_score, skills_score, experience_score, ai_summary, ai_recommendation, stage, cover_letter, source, created_at, job:enterprise_jobs(title)")
    .eq("org_id", orgId)
    .not("stage", "eq", "hired")
    .order("match_score", { ascending: false, nullsFirst: false })
    .limit(300);

  // Pull talent pool
  const { data: poolCandidates } = await supabaseAdmin
    .from("enterprise_talent_pool")
    .select("id, candidate_name, candidate_email, candidate_phone, linkedin_url, match_score, source_job_title, skills_tags, notes, status")
    .eq("org_id", orgId)
    .neq("status", "placed")
    .order("match_score", { ascending: false, nullsFirst: false })
    .limit(150);

  // Build compact candidate summaries for the LLM
  const appSummaries = (applications ?? []).map((a) => ({
    id: a.id as string,
    source: "application" as const,
    name: a.candidate_name as string | null,
    email: a.candidate_email as string | null,
    phone: (a.candidate_phone ?? null) as string | null,
    linkedin: (a.linkedin_url ?? null) as string | null,
    match_score: (a.match_score ?? 0) as number,
    applied_for: ((a.job as unknown as { title: string } | null)?.title ?? "") as string,
    stage: a.stage as string | null,
    ai_summary: (a.ai_summary ?? "") as string,
    ai_rec: (a.ai_recommendation ?? "") as string,
    cover_snippet: ((a.cover_letter ?? "") as string).slice(0, 200),
  }));

  const poolSummaries = (poolCandidates ?? []).map((p) => ({
    id: p.id as string,
    source: "pool" as const,
    name: p.candidate_name as string | null,
    email: p.candidate_email as string | null,
    phone: (p.candidate_phone ?? null) as string | null,
    linkedin: (p.linkedin_url ?? null) as string | null,
    match_score: (p.match_score ?? 0) as number,
    applied_for: (p.source_job_title ?? "") as string,
    stage: p.status as string | null,
    ai_summary: ((p.skills_tags ?? []) as string[]).join(", ") || (p.notes as string | null) || "",
    ai_rec: "",
    cover_snippet: (p.notes ?? "") as string,
  }));

  const allCandidates = [...appSummaries, ...poolSummaries];
  if (allCandidates.length === 0) {
    return { candidates: [], total_searched: 0 };
  }

  const candidateBlock = allCandidates
    .map(
      (c, i) =>
        `[${i}] ${c.name} | applied_for: "${c.applied_for}" | stage: ${c.stage} | score: ${c.match_score} | ${c.ai_summary || c.cover_snippet || "no summary"}`,
    )
    .join("\n");

  const prompt = `You are an expert talent sourcer. A recruiter has asked:
"${query}"${jobContext}

Below are ${allCandidates.length} candidates from this company's database (past applicants + talent pool).
Identify and rank the TOP ${Math.min(limit, allCandidates.length)} best matches. For each match, explain in one sentence why they fit.

Candidates:
${candidateBlock}

Return JSON array (no markdown):
[
  { "index": <number>, "fit_reason": "<1 sentence why this candidate fits>", "relevance_score": <0-100> },
  ...
]
Only include candidates who are genuinely relevant. If fewer than ${limit} are relevant, return fewer.`;

  let ranked: { index: number; fit_reason: string; relevance_score: number }[] = [];
  try {
    const response = await getAIClient(AI_TIERS.fast.provider).chat.completions.create({
      model: AI_TIERS.fast.model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1500,
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    recordUsage({ userId, feature: "sourcing_search", model: AI_TIERS.fast.model, usage: { prompt_tokens: response.usage?.prompt_tokens, completion_tokens: response.usage?.completion_tokens } });

    // The model may return { results: [...] } or just an array wrapped in an object
    const parsed = JSON.parse(raw);
    ranked = Array.isArray(parsed) ? parsed : (parsed.results ?? parsed.candidates ?? Object.values(parsed)[0] ?? []);
  } catch {
    // Fall back to score-based ranking if the LLM fails
    ranked = allCandidates
      .slice(0, limit)
      .map((_, i) => ({ index: i, fit_reason: "Strong match based on previous screening score.", relevance_score: allCandidates[i].match_score }));
  }

  const results = ranked
    .filter((r) => r.index >= 0 && r.index < allCandidates.length)
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, limit)
    .map((r) => ({
      ...allCandidates[r.index],
      fit_reason: r.fit_reason,
      relevance_score: r.relevance_score,
    }));

  return { candidates: results, total_searched: allCandidates.length };
}
