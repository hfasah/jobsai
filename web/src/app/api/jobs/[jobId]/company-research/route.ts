import { auth } from "@clerk/nextjs/server";
import { blockNonJobSeeker } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;

export interface CompanyResearchResult {
  overview: string;
  size: string;
  industry: string;
  culture_bullets: string[];
  interview_tips: string[];
  common_questions: string[];
  pros: string[];
  cons: string[];
  recent_context: string;
}

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// GET /api/jobs/[jobId]/company-research
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;

  const { jobId } = await params;

  const { data } = await supabaseAdmin
    .from("company_research")
    .select("result_json")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  return NextResponse.json({ data: data?.result_json ?? null });
}

// POST /api/jobs/[jobId]/company-research
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;

  const { jobId } = await params;

  // Load job (ownership + company name)
  const { data: jobRow } = await supabaseAdmin
    .from("jobs")
    .select("id, source_url, parsed:job_parsed(parsed_json)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (!jobRow) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const parsedRel = jobRow.parsed as { parsed_json: Record<string, unknown> }[] | { parsed_json: Record<string, unknown> } | null;
  const parsed = Array.isArray(parsedRel) ? parsedRel[0]?.parsed_json : parsedRel?.parsed_json;

  const company = (parsed?.company as string) ?? "";
  const title = (parsed?.title as string) ?? "";
  const industry = (parsed?.industry as string) ?? "";
  const skills = ((parsed?.skills as string[]) ?? []).slice(0, 8).join(", ");

  if (!company) {
    return NextResponse.json({ error: "Company name not found in job details." }, { status: 422 });
  }

  const systemPrompt = `You are a career research assistant. Return ONLY a valid JSON object matching this exact schema:
{
  "overview": "2–3 sentence description of the company",
  "size": "one of: Startup (1–50), Small (51–200), Mid-size (201–1000), Large (1001–5000), Enterprise (5000+)",
  "industry": "primary industry/sector",
  "culture_bullets": ["4–5 concise culture observations"],
  "interview_tips": ["5–6 practical tips for interviewing at this company"],
  "common_questions": ["5–6 common interview questions for this type of role here"],
  "pros": ["3–4 reasons employees like working there"],
  "cons": ["3–4 common criticisms or challenges"],
  "recent_context": "any notable recent news, funding, layoffs, acquisitions, or product launches — or empty string if unknown"
}
Keep every string concise. Do not use markdown formatting inside strings.`;

  const userPrompt = `Company: ${company}
Role being applied for: ${title || "not specified"}
Known skills/tech stack: ${skills || "not specified"}
${industry ? `Industry hint: ${industry}` : ""}

Research this company and fill out the schema above. If the company is obscure or unknown, give reasonable inferences based on the role and any context you have.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    const result = JSON.parse(content) as CompanyResearchResult;

    // Upsert (replace existing for this job+user)
    await supabaseAdmin.from("company_research").upsert(
      { job_id: jobId, user_id: userId, company_name: company, result_json: result },
      { onConflict: "job_id,user_id" }
    );

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("Company research error:", err);
    return NextResponse.json({ error: "Research failed. Please try again." }, { status: 500 });
  }
}
