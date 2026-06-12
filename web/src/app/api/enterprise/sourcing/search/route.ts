import { auth } from "@clerk/nextjs/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { recordUsage } from "@/lib/llm-usage";

export const maxDuration = 45;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "ai_sourcing");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { query, job_id, limit = 20 } = await req.json().catch(() => ({}));
  if (!query?.trim()) return NextResponse.json({ error: "query is required." }, { status: 400 });

  // Fetch job context if provided
  let jobContext = "";
  if (job_id) {
    const { data: job } = await supabaseAdmin
      .from("enterprise_jobs")
      .select("title, description, qualifications, responsibilities")
      .eq("id", job_id)
      .eq("org_id", org.id)
      .maybeSingle();
    if (job) {
      jobContext = `\nTarget job: ${job.title}\nRequirements: ${(job.qualifications ?? "").slice(0, 400)}\nResponsibilities: ${(job.responsibilities ?? "").slice(0, 300)}`;
    }
  }

  // Pull past applicants (up to 300, ranked by score)
  const { data: applications } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id, candidate_name, candidate_email, candidate_phone, linkedin_url, match_score, skills_score, experience_score, ai_summary, ai_recommendation, stage, cover_letter, source, created_at, job:enterprise_jobs(title)")
    .eq("org_id", org.id)
    .not("stage", "eq", "hired")
    .order("match_score", { ascending: false, nullsFirst: false })
    .limit(300);

  // Pull talent pool
  const { data: poolCandidates } = await supabaseAdmin
    .from("enterprise_talent_pool")
    .select("id, candidate_name, candidate_email, candidate_phone, linkedin_url, match_score, source_job_title, skills_tags, notes, status")
    .eq("org_id", org.id)
    .neq("status", "placed")
    .order("match_score", { ascending: false, nullsFirst: false })
    .limit(150);

  // Build compact candidate summaries for GPT
  const appSummaries = (applications ?? []).map((a) => ({
    id: a.id,
    source: "application" as const,
    name: a.candidate_name,
    email: a.candidate_email,
    phone: a.candidate_phone ?? null,
    linkedin: a.linkedin_url ?? null,
    match_score: a.match_score ?? 0,
    applied_for: (a.job as unknown as { title: string } | null)?.title ?? "",
    stage: a.stage,
    ai_summary: a.ai_summary ?? "",
    ai_rec: a.ai_recommendation ?? "",
    cover_snippet: (a.cover_letter ?? "").slice(0, 200),
  }));

  const poolSummaries = (poolCandidates ?? []).map((p) => ({
    id: p.id,
    source: "pool" as const,
    name: p.candidate_name,
    email: p.candidate_email,
    phone: p.candidate_phone ?? null,
    linkedin: p.linkedin_url ?? null,
    match_score: p.match_score ?? 0,
    applied_for: p.source_job_title ?? "",
    stage: p.status,
    ai_summary: (p.skills_tags ?? []).join(", ") || p.notes || "",
    ai_rec: "",
    cover_snippet: p.notes ?? "",
  }));

  const allCandidates = [...appSummaries, ...poolSummaries];

  if (allCandidates.length === 0) {
    return NextResponse.json({ data: { candidates: [], total_searched: 0, query } });
  }

  // Send to GPT for natural language ranking
  const candidateBlock = allCandidates.map((c, i) =>
    `[${i}] ${c.name} | applied_for: "${c.applied_for}" | stage: ${c.stage} | score: ${c.match_score} | ${c.ai_summary || c.cover_snippet || "no summary"}`
  ).join("\n");

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
    const response = await ai().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1500,
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    recordUsage({ userId, feature: "sourcing_search", model: "gpt-4o-mini", usage: { prompt_tokens: response.usage?.prompt_tokens, completion_tokens: response.usage?.completion_tokens } });

    // GPT may return { results: [...] } or just an array wrapped in an object
    const parsed = JSON.parse(raw);
    ranked = Array.isArray(parsed) ? parsed : (parsed.results ?? parsed.candidates ?? Object.values(parsed)[0] ?? []);
  } catch {
    // Fall back to score-based ranking if GPT fails
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

  return NextResponse.json({
    data: {
      candidates: results,
      total_searched: allCandidates.length,
      query,
    },
  });
}
