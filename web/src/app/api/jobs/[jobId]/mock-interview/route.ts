import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { loadJobContext, isContextError } from "@/lib/job-context";
import { supabaseAdmin } from "@/lib/supabase";
import { deductTokens, getTokenBalance, TOKEN_COSTS } from "@/lib/tokens";
import { INTERVIEW_TOOL_GUARDRAILS } from "@/lib/avatar";

export const maxDuration = 60;

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export type InterviewType = "behavioral" | "technical" | "leadership" | "mixed";

// Six dimensions the written coach scores, each 0–100.
export interface SubScores {
  technical_accuracy: number;
  communication: number;
  star: number;          // STAR methodology usage
  completeness: number;
  confidence: number;    // confidence indicators in the writing
  grammar: number;       // grammar & professionalism
}

export interface MockEvaluation {
  score: number;          // 1–5 overall
  subscores: SubScores;
  summary: string;        // one concise sentence
  strengths: string[];    // 2–3 items
  improvements: string[]; // 2–3 items
  model_answer: string;   // 2–4 sentences
  balance?: number;       // remaining tokens after this eval
}

const TYPE_GUIDANCE: Record<InterviewType, string> = {
  behavioral: "This is a BEHAVIORAL interview. Weight STAR structure, specific situations, and measurable outcomes most heavily.",
  technical: "This is a TECHNICAL interview. Weight technical accuracy, depth, correct terminology, and concrete examples most heavily.",
  leadership: "This is a LEADERSHIP interview. Weight strategic thinking, people/stakeholder management, decision-making, and ownership most heavily.",
  mixed: "This is a MIXED interview. Balance technical accuracy, behavioral STAR structure, and communication evenly.",
};

// POST /api/jobs/[jobId]/mock-interview
//  • eval:     { question, answer, category, interview_type }
//  • finalize: { action: "finalize", interview_type, scores, subscores, tokens_spent }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const body = await req.json().catch(() => ({}));

  // ── Finalize: persist the completed session for history / analytics ────────
  if (body.action === "finalize") {
    const scores: number[] = Array.isArray(body.scores) ? body.scores : [];
    const overall = scores.length
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100
      : null;
    try {
      await supabaseAdmin.from("interview_sessions").insert({
        user_id: userId,
        job_id: jobId,
        mode: "written",
        interview_type: body.interview_type ?? "mixed",
        overall_score: overall,
        subscores: body.subscores ?? {},
        question_count: scores.length,
        tokens_spent: typeof body.tokens_spent === "number" ? body.tokens_spent : 0,
      });
    } catch (err) {
      console.error("interview_sessions insert failed:", err);
    }
    return NextResponse.json({ data: { saved: true } });
  }

  // ── Evaluation ─────────────────────────────────────────────────────────────
  const { question, answer, category, interview_type } = body as {
    question?: string;
    answer?: string;
    category?: string;
    interview_type?: InterviewType;
  };

  if (!question || !answer?.trim()) {
    return NextResponse.json({ error: "question and answer are required." }, { status: 400 });
  }

  // Token gate — block before spending the OpenAI call if the user can't afford it.
  const cost = TOKEN_COSTS.written_eval;
  const balance = await getTokenBalance(userId);
  if (balance < cost) {
    return NextResponse.json(
      {
        error: `You're out of tokens. A written evaluation costs ${cost} tokens and you have ${balance}. Upgrade your plan or top up to keep practicing.`,
        upgrade_required: true,
        balance,
      },
      { status: 402 }
    );
  }

  const ctx = await loadJobContext(userId, jobId);
  if (isContextError(ctx)) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  const jobTitle = ctx.jobParsed.title ?? "the role";
  const requirements = (ctx.jobParsed.requirements ?? []).slice(0, 8).join("; ");
  const resumeName = ctx.resumeProfile.name ?? "the candidate";
  const resumeExp = (ctx.resumeProfile.experience ?? [])
    .slice(0, 3)
    .map((e) => `${e.title} at ${e.company}`)
    .join(", ");

  const itype: InterviewType = interview_type ?? "mixed";

  const systemPrompt = `You are an expert interview coach evaluating a candidate's written mock interview answer.
${TYPE_GUIDANCE[itype]}
${INTERVIEW_TOOL_GUARDRAILS}
Return ONLY valid JSON — no markdown, no explanation.

Schema:
{
  "score": <integer 1-5 overall>,
  "subscores": {
    "technical_accuracy": <integer 0-100>,
    "communication": <integer 0-100>,
    "star": <integer 0-100, how well the answer uses Situation-Task-Action-Result structure>,
    "completeness": <integer 0-100, did it fully address the question>,
    "confidence": <integer 0-100, confidence indicators in the writing>,
    "grammar": <integer 0-100, grammar and professionalism>
  },
  "summary": "<one concise sentence assessing the answer>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "model_answer": "<2-4 sentence ideal answer tailored to this role and the candidate's background>"
}

Overall score guide:
1 = Very weak — off-topic, vague, or very short
2 = Below average — minimal substance, missing key elements
3 = Average — covers basics but lacks depth or specifics
4 = Good — clear, specific, well-structured with minor gaps
5 = Excellent — compelling, specific, well-structured, quantified impact
Keep subscores internally consistent with the overall score.`;

  const userPrompt = `Role: ${jobTitle}
Key requirements: ${requirements || "not specified"}
Candidate background: ${resumeName}, previously ${resumeExp || "not specified"}
Question category: ${category ?? "general"}

Question: ${question}

Candidate's answer: ${answer.trim()}`;

  let evaluation: MockEvaluation;
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response");
    evaluation = JSON.parse(content) as MockEvaluation;
  } catch (err) {
    console.error("Mock interview eval error:", err);
    return NextResponse.json({ error: "Evaluation failed. Please try again." }, { status: 500 });
  }

  // Charge only on a successful evaluation.
  const spend = await deductTokens(userId, cost, "written_eval", { jobId });
  evaluation.balance = spend.balance;

  return NextResponse.json({ data: evaluation });
}
