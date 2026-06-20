import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { recordUsage } from "@/lib/llm-usage";

export const maxDuration = 45;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= getAIClient(AI_TIERS.fast.provider);

type Ctx = { params: Promise<{ poolId: string }> };

// POST — generate ONE standardized question set for the whole pool, from the
// combination of: required criteria + job description + candidates' cover letters
// + any additional HR/hiring-manager context. Same questions for every candidate.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { poolId } = await params;
  const body = await req.json().catch(() => ({}));

  const { data: pool } = await supabaseAdmin
    .from("enterprise_pools").select("*").eq("id", poolId).eq("org_id", org.id).maybeSingle();
  if (!pool) return NextResponse.json({ error: "Pool not found." }, { status: 404 });

  // Persist any newly-edited criteria / additional context first
  const criteria = body.criteria ?? pool.criteria ?? "";
  const additionalContext = body.additional_context ?? pool.additional_context ?? "";

  const { data: job } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("title, description, qualifications, responsibilities, nice_to_have")
    .eq("id", pool.job_id).maybeSingle();

  // Sample cover letters from candidates in this pool (for shared themes)
  const { data: members } = await supabaseAdmin
    .from("enterprise_applications")
    .select("cover_letter")
    .eq("pool_id", poolId)
    .not("cover_letter", "is", null)
    .limit(5);

  const coverLetters = (members ?? [])
    .map((m) => m.cover_letter)
    .filter(Boolean)
    .map((c, i) => `Cover letter ${i + 1}: ${(c as string).slice(0, 400)}`)
    .join("\n\n");

  const prompt = `You are an expert interviewer. Build ONE standardized interview question set for a pool of candidates applying to the same role. Every candidate in this pool will be asked the SAME questions, so keep them fair and role-general (not tied to one person).

ROLE: ${job?.title ?? "the role"}
${job?.description ? `Job description: ${job.description.slice(0, 600)}` : ""}
${job?.qualifications ? `Required criteria: ${job.qualifications.slice(0, 500)}` : ""}
${job?.responsibilities ? `Responsibilities: ${job.responsibilities.slice(0, 400)}` : ""}
${criteria ? `Additional required criteria (from HR): ${criteria}` : ""}
${additionalContext ? `Extra context from hiring manager: ${additionalContext}` : ""}
${coverLetters ? `\nThemes from candidates' cover letters (probe these):\n${coverLetters}` : ""}

Return ONLY valid JSON:
{
  "questions": [
    { "id": "q1", "type": "behavioral | technical | situational | motivation | culture", "question": "the question text" }
  ]
}
Produce 8-10 questions: a mix of behavioral, technical/role-specific, situational, and motivation. Specific to this role and criteria.`;

  try {
    const completion = await ai().chat.completions.create({
      model: AI_TIERS.fast.model, max_tokens: 1400, response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });
    recordUsage({ orgId: org.id, userId, feature: "pool_questions", model: AI_TIERS.fast.model, usage: completion.usage });
    const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");

    const { data, error } = await supabaseAdmin
      .from("enterprise_pools")
      .update({
        question_set: parsed.questions ?? [],
        criteria, additional_context: additionalContext,
        updated_at: new Date().toISOString(),
      })
      .eq("id", poolId).eq("org_id", org.id)
      .select("*").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("Pool question generation error:", err);
    return NextResponse.json({ error: "Failed to generate questions." }, { status: 500 });
  }
}
