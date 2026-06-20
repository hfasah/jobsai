import { auth } from "@clerk/nextjs/server";
import { blockNonJobSeeker } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;

export interface SalaryFactor {
  label: string;
  value: string;
  note: string;
}

export interface SalaryIntelResult {
  currency: string;
  range_min: number;
  range_max: number;
  range_median: number;
  p25: number;
  p50: number;
  p75: number;
  market_context: string;
  vs_posting: string | null;
  factors: SalaryFactor[];
  negotiation_tips: string[];
  total_comp_context: string;
  data_note: string;
}

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = getAIClient(AI_TIERS.smart.provider);
  return _openai;
}

// GET /api/jobs/[jobId]/salary-intel
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;

  const { jobId } = await params;

  const { data } = await supabaseAdmin
    .from("salary_intel")
    .select("result_json")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  return NextResponse.json({ data: data?.result_json ?? null });
}

// POST /api/jobs/[jobId]/salary-intel
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;

  const { jobId } = await params;

  const { data: jobRow } = await supabaseAdmin
    .from("jobs")
    .select("id, parsed:job_parsed(parsed_json)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (!jobRow) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const parsedRel = jobRow.parsed as { parsed_json: Record<string, unknown> }[] | { parsed_json: Record<string, unknown> } | null;
  const parsed = Array.isArray(parsedRel) ? parsedRel[0]?.parsed_json : parsedRel?.parsed_json;

  const title      = (parsed?.title       as string) ?? "";
  const company    = (parsed?.company     as string) ?? "";
  const location   = (parsed?.location    as string) ?? "";
  const seniority  = (parsed?.seniority   as string) ?? "";
  const empType    = (parsed?.employment_type as string) ?? "";
  const posted_comp = (parsed?.compensation as string) ?? "";
  const skills     = ((parsed?.skills as string[]) ?? []).slice(0, 10).join(", ");

  if (!title) {
    return NextResponse.json({ error: "Job title not found." }, { status: 422 });
  }

  const systemPrompt = `You are a compensation analyst with expertise in tech and professional job markets.
Return ONLY a valid JSON object matching this exact schema:
{
  "currency": "USD",
  "range_min": <integer annual salary>,
  "range_max": <integer annual salary>,
  "range_median": <integer annual salary>,
  "p25": <integer — 25th percentile for this role/market>,
  "p50": <integer — 50th percentile / market median>,
  "p75": <integer — 75th percentile>,
  "market_context": "<2-3 sentences on what drives pay for this role in this market>",
  "vs_posting": "<one sentence comparing posted compensation to market, or null if no posted comp>",
  "factors": [
    { "label": "<factor name>", "value": "<e.g. +12%>", "note": "<brief explanation>" }
  ],
  "negotiation_tips": ["<tip 1>", "<tip 2>", "<tip 3>", "<tip 4>"],
  "total_comp_context": "<one paragraph on typical total comp — equity, bonus, benefits — for this company type>",
  "data_note": "Estimates based on market knowledge through early 2024. Cross-check with Levels.fyi, Glassdoor, or Blind for live data."
}
Rules:
- All salary values are annual, in the stated currency, as integers (no decimals)
- factors: 3-4 items covering location, seniority, company type, industry, specialisation
- negotiation_tips: 4 practical, specific tips for this role/company type
- If location suggests a non-USD market, use the appropriate currency and realistic local values
- Be specific — don't give ranges like "varies widely"`;

  const userPrompt = `Role: ${title}
Company: ${company || "not specified"}
Location: ${location || "not specified"}
Seniority: ${seniority || "not specified"}
Employment type: ${empType || "not specified"}
Key skills: ${skills || "not specified"}
${posted_comp ? `Posted compensation: ${posted_comp}` : "No compensation posted"}

Generate the salary intelligence report.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: AI_TIERS.smart.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    const result = JSON.parse(content) as SalaryIntelResult;

    await supabaseAdmin.from("salary_intel").upsert(
      { job_id: jobId, user_id: userId, result_json: result },
      { onConflict: "job_id,user_id" }
    );

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("Salary intel error:", err);
    return NextResponse.json({ error: "Analysis failed. Please try again." }, { status: 500 });
  }
}
