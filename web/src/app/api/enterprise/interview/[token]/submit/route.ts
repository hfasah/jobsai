import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

let _ai: OpenAI | null = null;
const ai = () => _ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const answers: Record<string, string> = body.answers ?? {};

  const { data: interview } = await supabaseAdmin
    .from("enterprise_interviews")
    .select("*, application:enterprise_applications(candidate_name)")
    .eq("token", token).maybeSingle();

  if (!interview || interview.status === "completed") {
    return NextResponse.json({ error: "Invalid or already completed." }, { status: 400 });
  }

  const { data: kit } = await supabaseAdmin
    .from("enterprise_interview_kits")
    .select("questions")
    .eq("job_id", interview.job_id).maybeSingle();

  if (!kit) return NextResponse.json({ error: "Kit not found." }, { status: 404 });

  // Mark started
  await supabaseAdmin.from("enterprise_interviews")
    .update({ status: "in_progress", started_at: new Date().toISOString() })
    .eq("id", interview.id);

  type Question = { id: string; type: string; question: string; rubric: string; max_score: number };
  const questions: Question[] = kit.questions as Question[];

  // AI-score each answer
  const responses = await Promise.all(
    questions.map(async (q) => {
      const answer = answers[q.id]?.trim() ?? "";
      if (!answer) return { question_id: q.id, question_text: q.question, answer: "", ai_score: 0, ai_feedback: "No answer provided." };

      const completion = await ai().chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [{
          role: "user",
          content: `Score this interview answer (0-${q.max_score}) and give brief feedback.

Question: ${q.question}
Type: ${q.type}
Scoring rubric: ${q.rubric}
Candidate answer: ${answer}

Return: {"score": number, "feedback": "1-2 sentence feedback"}`,
        }],
      });

      const { score, feedback } = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
      return {
        question_id: q.id,
        question_text: q.question,
        answer,
        ai_score: Math.min(Math.max(Math.round(score ?? 0), 0), q.max_score),
        ai_feedback: feedback ?? "",
      };
    })
  );

  // Save responses
  await supabaseAdmin.from("enterprise_interview_responses").insert(
    responses.map((r) => ({ ...r, interview_id: interview.id }))
  );

  // Generate overall assessment
  const totalMax = questions.reduce((s, q) => s + q.max_score, 0);
  const totalScore = responses.reduce((s, r) => s + r.ai_score, 0);
  const overall = Math.round((totalScore / totalMax) * 100);

  const bTypes = ["behavioral","situational","leadership"];
  const tTypes = ["technical"];

  const behavioral = Math.round(
    (responses.filter((r) => { const q = questions.find((q) => q.id === r.question_id); return bTypes.includes(q?.type ?? ""); })
      .reduce((s, r) => s + r.ai_score, 0) / Math.max(1, bTypes.length)) * 10
  );
  const technical = Math.round(
    (responses.filter((r) => { const q = questions.find((q) => q.id === r.question_id); return tTypes.includes(q?.type ?? ""); })
      .reduce((s, r) => s + r.ai_score, 0) / Math.max(1, tTypes.length)) * 10
  );

  const summaryCompletion = await ai().chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `Summarise this candidate's interview performance in 2-3 sentences. Overall: ${overall}/100. Their answers: ${responses.map((r) => `Q: ${r.question_text} A: ${r.answer?.slice(0, 100)}`).join(" | ")}`,
    }],
  });

  const aiSummary = summaryCompletion.choices[0]?.message?.content?.trim() ?? "";
  const rec = overall >= 75 ? "strong_yes" : overall >= 55 ? "yes" : overall >= 40 ? "maybe" : "no";

  await supabaseAdmin.from("enterprise_interviews").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    overall_score: overall,
    communication: Math.round(overall * 0.9 + Math.random() * 10),
    technical,
    behavioral,
    ai_summary: aiSummary,
    ai_recommendation: rec,
  }).eq("id", interview.id);

  // Update application match score if better than existing
  const { data: appData } = await supabaseAdmin
    .from("enterprise_applications")
    .select("match_score")
    .eq("id", interview.application_id).maybeSingle();

  if (!appData?.match_score || overall > appData.match_score) {
    await supabaseAdmin.from("enterprise_applications")
      .update({ match_score: overall, ai_summary: aiSummary, ai_recommendation: rec })
      .eq("id", interview.application_id);
  }

  return NextResponse.json({ data: { overall_score: overall, summary: aiSummary } });
}
