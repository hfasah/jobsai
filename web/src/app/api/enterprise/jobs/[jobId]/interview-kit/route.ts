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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;

  const { data } = await supabaseAdmin
    .from("enterprise_interview_kits")
    .select("*")
    .eq("job_id", jobId)
    .eq("org_id", org.id)
    .maybeSingle();

  return NextResponse.json({ data });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { jobId } = await params;

  const { data: job } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("title, department, description, qualifications, responsibilities")
    .eq("id", jobId).eq("org_id", org.id).maybeSingle();

  if (!job) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const prompt = `Generate a comprehensive interview kit for this role.

Role: ${job.title}${job.department ? ` — ${job.department}` : ""}
${job.description ? `Overview: ${job.description?.slice(0, 400)}` : ""}
${job.qualifications ? `Requirements: ${job.qualifications?.slice(0, 400)}` : ""}
${job.responsibilities ? `Responsibilities: ${job.responsibilities?.slice(0, 400)}` : ""}

Return JSON with exactly this structure:
{
  "questions": [
    {
      "id": "q1",
      "type": "behavioral",
      "question": "Tell me about a time you...",
      "rubric": "What a strong answer looks like (2-3 sentences)",
      "max_score": 10
    }
  ]
}

Include exactly:
- 3 behavioral questions (STAR method)
- 3 technical questions (specific to role requirements)
- 2 leadership/situational questions
- 1 culture-fit / motivation question

Total: 9 questions. Make them specific to this role, not generic.`;

  try {
    const completion = await ai().chat.completions.create({
      model: AI_TIERS.fast.model,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    });

    recordUsage({ orgId: org.id, userId, feature: "interview_kit", model: AI_TIERS.fast.model, usage: completion.usage });
    const { questions } = JSON.parse(completion.choices[0]?.message?.content ?? "{}");

    const { data, error } = await supabaseAdmin
      .from("enterprise_interview_kits")
      .upsert({ job_id: jobId, org_id: org.id, questions }, { onConflict: "job_id" })
      .select("*").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    console.error("Interview kit generation error:", err);
    return NextResponse.json({ error: "Generation failed." }, { status: 500 });
  }
}
