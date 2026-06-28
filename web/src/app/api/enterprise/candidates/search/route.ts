import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export const maxDuration = 20;

let _ai: OpenAI | null = null;
const ai = () => (_ai ??= getAIClient(AI_TIERS.fast.provider));

// POST /api/enterprise/candidates/search
// body: { query: string, jobId?: string }
// Natural-language search over the org's candidate database.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const query: string = (body.query ?? "").trim();
  const jobId: string | undefined = body.jobId;

  if (!query) return NextResponse.json({ error: "Query required." }, { status: 400 });

  // Step 1: use the LLM to expand the natural-language query into search keywords
  // (skills, location/country, job title, candidate name, experience terms — plus
  // useful synonyms like "AWS" → "amazon web services") and any score/stage filter.
  const filterPrompt = `A recruiter is searching their candidate database. Expand this query into search keywords and filters. Return ONLY valid JSON.

Query: "${query}"

Return:
{
  "keywords": ["<term>"],           // every searchable term: skills, tools, location/country, job title, candidate name, seniority/experience — INCLUDE common synonyms/abbreviations (e.g. "aws" and "amazon web services")
  "min_score": <number|null>,        // minimum ATS/match score 0-100 if the query asks for it
  "stages": ["<stage>"],             // applied/screened/interview/offer/hired/rejected if mentioned
  "recommendation": "<string|null>"  // strong_yes/yes/maybe/no if mentioned
}`;

  const filterRes = await ai().chat.completions.create({
    model: AI_TIERS.fast.model,
    max_tokens: 250,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: filterPrompt }],
  });

  let filters: {
    keywords?: string[];
    min_score?: number | null;
    stages?: string[];
    recommendation?: string | null;
  } = {};
  try {
    filters = JSON.parse(filterRes.choices[0]?.message?.content ?? "{}");
  } catch { /* use empty filters */ }

  // Combine the LLM keywords with the raw query words (so it still works if the
  // model returns nothing). De-dupe, drop tiny stopwords.
  const STOP = new Set(["the", "and", "for", "with", "who", "has", "any", "all", "yrs", "years", "year", "experience", "candidate", "candidates"]);
  const keywords = [...new Set([
    ...(filters.keywords ?? []),
    ...query.split(/[\s,+/]+/),
  ].map((k) => k.trim().toLowerCase()).filter((k) => k.length >= 2 && !STOP.has(k)))];

  // Step 2: fetch a broad pool (incl. UNSCREENED candidates) so we can match
  // keywords against everything — résumé text, phone, etc. — not just top scores.
  let dbQuery = supabaseAdmin
    .from("enterprise_applications")
    .select("id,candidate_name,candidate_email,candidate_phone,candidate_location,stage,match_score,ats_score,skills_score,experience_score,ai_summary,ai_recommendation,tags,risk_flags,resume_text,resume_storage_key,resume_url,source,created_at,job:enterprise_jobs(id,title)")
    .eq("org_id", org.id)
    .order("match_score", { ascending: false, nullsFirst: false })
    .limit(keywords.length ? 400 : 50);

  if (jobId) dbQuery = dbQuery.eq("job_id", jobId);
  if (filters.min_score) dbQuery = dbQuery.gte("match_score", filters.min_score);
  if (filters.stages?.length) dbQuery = dbQuery.in("stage", filters.stages);
  if (filters.recommendation) dbQuery = dbQuery.eq("ai_recommendation", filters.recommendation);

  const { data: candidates, error } = await dbQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Step 3: match keywords across the WHOLE candidate — name, email, phone, tags,
  // AI summary, and raw résumé text (so name / skill / country / phone /
  // experience all work). Rank by how many keywords hit.
  type Row = Record<string, unknown> & { tags?: string[] | null; ai_summary?: string | null; resume_text?: string | null; candidate_name?: string; candidate_email?: string; candidate_phone?: string | null; candidate_location?: string | null; match_score?: number | null };
  const scored = (candidates ?? []).map((c) => {
    const row = c as Row;
    const haystack = [
      ...(row.tags ?? []),
      row.candidate_name ?? "", row.candidate_email ?? "", row.candidate_phone ?? "", row.candidate_location ?? "",
      row.ai_summary ?? "", row.resume_text ?? "",
    ].join(" ").toLowerCase();
    const hits = keywords.filter((k) => haystack.includes(k)).length;
    return { row, hits };
  });
  const matched = keywords.length ? scored.filter((s) => s.hits > 0) : scored;
  matched.sort((a, b) => (b.hits - a.hits) || ((b.row.match_score ?? -1) - (a.row.match_score ?? -1)));

  // Drop the heavy résumé text from the response payload (used only for matching).
  const data = matched.map(({ row }) => {
    const copy: Record<string, unknown> = { ...row };
    delete copy.resume_text;
    return copy;
  });

  return NextResponse.json({
    data,
    filters_applied: filters,
    total: data.length,
  });
}
