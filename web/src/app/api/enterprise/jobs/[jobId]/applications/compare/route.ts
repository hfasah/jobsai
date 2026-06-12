import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export const maxDuration = 30;

let _ai: OpenAI | null = null;
const ai = () => (_ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

export interface CandidateComparison {
  id: string;
  name: string;
  strengths: string[];
  weaknesses: string[];
  risks: string[];
  fit_summary: string;
  recommendation: "advance" | "hold" | "reject";
}

export interface ComparisonResult {
  candidates: CandidateComparison[];
  winner_id: string | null;
  winner_reason: string;
  hiring_recommendation: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { jobId } = await params;
  const body = await req.json().catch(() => ({}));
  const appIds: string[] = Array.isArray(body.appIds) ? body.appIds.slice(0, 3) : [];

  if (appIds.length < 2) {
    return NextResponse.json({ error: "Select 2 or 3 candidates to compare." }, { status: 400 });
  }

  // Fetch job + candidates
  const [jobRes, appsRes] = await Promise.all([
    supabaseAdmin.from("enterprise_jobs").select("title,description,qualifications").eq("id", jobId).eq("org_id", org.id).maybeSingle(),
    supabaseAdmin.from("enterprise_applications")
      .select("id,candidate_name,candidate_email,stage,match_score,skills_score,experience_score,culture_score,ats_score,ai_summary,ai_recommendation,risk_flags,tags,resume_text")
      .in("id", appIds)
      .eq("org_id", org.id),
  ]);

  const job = jobRes.data;
  const apps = appsRes.data ?? [];
  if (apps.length < 2) return NextResponse.json({ error: "Candidates not found." }, { status: 404 });

  const candidateBlocks = apps.map((a) => `
CANDIDATE: ${a.candidate_name}
- Match score: ${a.match_score ?? "not scored"}%
- Skills: ${a.skills_score ?? "?"}% | Experience: ${a.experience_score ?? "?"}% | Culture: ${a.culture_score ?? "?"}% | ATS: ${a.ats_score ?? "?"}%
- AI recommendation: ${a.ai_recommendation ?? "none"}
- AI summary: ${a.ai_summary ?? "none"}
- Risk flags: ${a.risk_flags?.join(", ") || "none"}
- Tags: ${a.tags?.join(", ") || "none"}
- Resume excerpt: ${(a.resume_text ?? "").slice(0, 600)}
`).join("\n---\n");

  const prompt = `You are a senior recruitment advisor. Compare these ${apps.length} candidates for the role below and return a JSON object.

ROLE: ${job?.title ?? "Unknown"}
${job?.description ? `Description: ${job.description.slice(0, 400)}` : ""}
${job?.qualifications ? `Requirements: ${job.qualifications.slice(0, 400)}` : ""}

CANDIDATES:
${candidateBlocks}

Return ONLY valid JSON matching this exact structure:
{
  "candidates": [
    {
      "id": "<candidate id>",
      "name": "<name>",
      "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
      "weaknesses": ["<weakness 1>", "<weakness 2>"],
      "risks": ["<risk 1>"],
      "fit_summary": "<2 sentence summary of fit for this specific role>",
      "recommendation": "advance" | "hold" | "reject"
    }
  ],
  "winner_id": "<id of strongest candidate, or null if tied>",
  "winner_reason": "<1-2 sentence explanation of why this candidate stands out>",
  "hiring_recommendation": "<2-3 sentence overall recommendation on who to advance and why>"
}`;

  const completion = await ai().chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1200,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  let result: ComparisonResult;
  try {
    result = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
    // Hydrate ids in case AI forgot them
    result.candidates = result.candidates?.map((c, i) => ({
      ...c,
      id: c.id || apps[i]?.id || "",
      name: c.name || apps[i]?.candidate_name || "",
    })) ?? [];
  } catch {
    return NextResponse.json({ error: "AI response parsing failed." }, { status: 500 });
  }

  return NextResponse.json({ data: result });
}
