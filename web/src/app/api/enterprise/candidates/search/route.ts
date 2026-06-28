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

  // Step 1: use GPT to extract structured filters from the natural-language query
  const filterPrompt = `Extract search filters from this recruiter query. Return ONLY valid JSON.

Query: "${query}"

Return:
{
  "skills": ["<skill>"],          // tech skills or keywords mentioned
  "min_score": <number|null>,      // minimum match score 0-100
  "stages": ["<stage>"],           // applied/screened/interview/offer/hired/rejected
  "recommendation": "<string|null>", // strong_yes/yes/maybe/no
  "limit": <number>                // how many results requested, default 10
}`;

  const filterRes = await ai().chat.completions.create({
    model: AI_TIERS.fast.model,
    max_tokens: 200,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: filterPrompt }],
  });

  let filters: {
    skills?: string[];
    min_score?: number | null;
    stages?: string[];
    recommendation?: string | null;
    limit?: number;
  } = {};
  try {
    filters = JSON.parse(filterRes.choices[0]?.message?.content ?? "{}");
  } catch { /* use empty filters */ }

  // Step 2: query Supabase with extracted filters
  // When skills are part of the query we post-filter across the whole pool —
  // including UNSCREENED candidates (no tags/summary yet) — by reading their raw
  // résumé text, so fetch a broad set. Otherwise just the top matches.
  const fetchLimit = (filters.skills?.length ?? 0) > 0 ? 400 : (filters.limit ?? 30);
  let dbQuery = supabaseAdmin
    .from("enterprise_applications")
    .select("id,candidate_name,candidate_email,stage,match_score,skills_score,experience_score,ai_summary,ai_recommendation,tags,risk_flags,resume_text,source,created_at,job:enterprise_jobs(id,title)")
    .eq("org_id", org.id)
    .order("match_score", { ascending: false, nullsFirst: false })
    .limit(fetchLimit);

  if (jobId) dbQuery = dbQuery.eq("job_id", jobId);
  if (filters.min_score) dbQuery = dbQuery.gte("match_score", filters.min_score);
  if (filters.stages?.length) dbQuery = dbQuery.in("stage", filters.stages);
  if (filters.recommendation) dbQuery = dbQuery.eq("ai_recommendation", filters.recommendation);

  const { data: candidates, error } = await dbQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Step 3: post-filter by skills/keywords — match across tags, AI summary, AND
  // raw résumé text (so candidates surface by skill even before AI screening).
  const skills = (filters.skills ?? []).map((s) => s.toLowerCase());
  const filtered = skills.length
    ? (candidates ?? []).filter((c) => {
        const haystack = [
          ...(c.tags ?? []),
          c.ai_summary ?? "",
          c.resume_text ?? "",
          c.candidate_name,
        ].join(" ").toLowerCase();
        return skills.some((s) => haystack.includes(s));
      })
    : (candidates ?? []);

  // Drop the heavy résumé text from the response payload (used only for matching).
  const data = filtered.map((c) => {
    const copy: Record<string, unknown> = { ...c };
    delete copy.resume_text;
    return copy;
  });

  return NextResponse.json({
    data,
    filters_applied: filters,
    total: data.length,
  });
}
