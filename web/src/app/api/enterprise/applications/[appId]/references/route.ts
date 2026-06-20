import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export const maxDuration = 30;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= getAIClient(AI_TIERS.fast.provider);

type Ctx = { params: Promise<{ appId: string }> };

// POST — add a referee; AI generates role-tailored reference questions
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { appId } = await params;
  const body = await req.json().catch(() => ({}));

  if (!body.referee_name?.trim()) return NextResponse.json({ error: "Referee name is required." }, { status: 400 });

  const { data: app } = await supabaseAdmin
    .from("enterprise_applications").select("job_id, candidate_name").eq("id", appId).eq("org_id", org.id).maybeSingle();
  if (!app) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });

  const { data: job } = await supabaseAdmin
    .from("enterprise_jobs").select("title, qualifications").eq("id", app.job_id).maybeSingle();

  // Generate reference questions
  let questions: { id: string; question: string }[] = [];
  try {
    const completion = await ai().chat.completions.create({
      model: AI_TIERS.fast.model, max_tokens: 700, response_format: { type: "json_object" },
      messages: [{ role: "user", content: `Generate 6 professional reference-check questions for a referee (${body.relationship ?? "former colleague"}) of ${app.candidate_name}, who is being hired as ${job?.title ?? "an employee"}. Cover: working relationship, key strengths, areas for development, reliability, would-rehire, and role-fit. Return JSON: {questions:[{id,question}]}` }],
    });
    questions = JSON.parse(completion.choices[0]?.message?.content ?? "{}").questions ?? [];
  } catch { /* fall back to defaults */ }

  if (!questions.length) {
    questions = [
      { id: "q1", question: "In what capacity did you work with the candidate, and for how long?" },
      { id: "q2", question: "What were the candidate's key strengths?" },
      { id: "q3", question: "What areas could the candidate develop further?" },
      { id: "q4", question: "How reliable and professional was the candidate?" },
      { id: "q5", question: "Would you rehire or work with this candidate again? Why?" },
      { id: "q6", question: "Is there anything else we should know?" },
    ];
  }

  const { data, error } = await supabaseAdmin.from("enterprise_references").insert({
    application_id: appId, job_id: app.job_id, org_id: org.id,
    referee_name: body.referee_name.trim(), referee_email: body.referee_email ?? null,
    referee_phone: body.referee_phone ?? null, relationship: body.relationship ?? null,
    company: body.company ?? null, questions, status: "pending",
  }).select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
