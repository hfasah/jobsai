import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { loadJobContext, isContextError } from "@/lib/job-context";

export const maxDuration = 60;

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export interface MockEvaluation {
  score: number;        // 1–5
  summary: string;      // one concise sentence
  strengths: string[];  // 2–3 items
  improvements: string[]; // 2–3 items
  model_answer: string; // 2–4 sentences
}

// POST /api/jobs/[jobId]/mock-interview
// Body: { question: string; answer: string; category: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const body = await req.json().catch(() => ({}));
  const { question, answer, category } = body as {
    question?: string;
    answer?: string;
    category?: string;
  };

  if (!question || !answer?.trim()) {
    return NextResponse.json({ error: "question and answer are required." }, { status: 400 });
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

  const systemPrompt = `You are an expert interview coach evaluating a candidate's mock interview answer.
Return ONLY valid JSON — no markdown, no explanation.

Schema:
{
  "score": <integer 1-5>,
  "summary": "<one concise sentence assessing the answer>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "improvements": ["<improvement 1>", "<improvement 2>"],
  "model_answer": "<2-4 sentence ideal answer tailored to this role and the candidate's background>"
}

Scoring guide:
1 = Very weak — off-topic, vague, or very short
2 = Below average — minimal substance, missing key elements
3 = Average — covers basics but lacks depth or specifics
4 = Good — clear, specific, well-structured with minor gaps
5 = Excellent — compelling, specific, well-structured, quantified impact`;

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

  return NextResponse.json({ data: evaluation });
}
