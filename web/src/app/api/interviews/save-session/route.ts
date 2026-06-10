import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

interface SaveSessionRequest {
  job_title?: string;
  job_description?: string;
  mode: "voice" | "avatar" | "text";
  responses: Array<{
    question_number: number;
    question: string;
    user_answer: string;
    star_score: number;
    clarity_score: number;
    technical_score: number;
    confidence_score: number;
    ai_feedback: string;
  }>;
}

// POST /api/interviews/save-session
// Save interview session and generate performance feedback
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as SaveSessionRequest;
  const { job_title, job_description, mode, responses } = body;

  if (!mode || !responses || responses.length === 0) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    // Create session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("interview_sessions")
      .insert({
        user_id: userId,
        job_title: job_title || "Practice Interview",
        job_description,
        mode,
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Save responses
    const responsesData = responses.map((r) => ({
      session_id: session.id,
      question_number: r.question_number,
      question: r.question,
      user_answer: r.user_answer,
      star_score: r.star_score,
      clarity_score: r.clarity_score,
      technical_score: r.technical_score,
      confidence_score: r.confidence_score,
      ai_feedback: r.ai_feedback,
    }));

    const { error: responsesError } = await supabaseAdmin
      .from("interview_responses")
      .insert(responsesData);

    if (responsesError) throw responsesError;

    // Calculate overall scores
    const avgStar = Math.round(
      responses.reduce((sum, r) => sum + r.star_score, 0) / responses.length
    );
    const avgClarity = Math.round(
      responses.reduce((sum, r) => sum + r.clarity_score, 0) / responses.length
    );
    const avgTechnical = Math.round(
      responses.reduce((sum, r) => sum + r.technical_score, 0) / responses.length
    );
    const avgConfidence = Math.round(
      responses.reduce((sum, r) => sum + r.confidence_score, 0) / responses.length
    );
    const avgExamples = avgStar; // based on STAR usage

    const overallScore = Math.round(
      (avgStar + avgClarity + avgTechnical + avgConfidence + avgExamples) / 5
    );

    // Generate insights (simplified AI logic)
    const strengths = generateStrengths(
      avgStar,
      avgClarity,
      avgTechnical,
      avgConfidence
    );
    const improvements = generateImprovements(
      avgStar,
      avgClarity,
      avgTechnical,
      avgConfidence
    );
    const recommendations = generateRecommendations(
      avgStar,
      avgClarity,
      avgTechnical
    );

    const summary = `You delivered a solid interview performance with an overall score of ${overallScore}/100. Your technical knowledge is strong, and you communicated your ideas clearly. Focus on structuring answers using the STAR method more consistently to make your examples even more impactful.`;

    // Save feedback
    const { error: feedbackError } = await supabaseAdmin
      .from("interview_feedback")
      .insert({
        session_id: session.id,
        star_score: avgStar,
        communication_score: avgClarity,
        technical_score: avgTechnical,
        confidence_score: avgConfidence,
        examples_score: avgExamples,
        strengths,
        improvements,
        ai_summary: summary,
        recommendations,
      });

    if (feedbackError) throw feedbackError;

    // Update session with overall score
    await supabaseAdmin
      .from("interview_sessions")
      .update({ overall_score: overallScore })
      .eq("id", session.id);

    return NextResponse.json({
      ok: true,
      session_id: session.id,
      overall_score: overallScore,
    });
  } catch (err) {
    console.error("Save session error:", err);
    return NextResponse.json(
      { error: "Failed to save interview session" },
      { status: 500 }
    );
  }
}

function generateStrengths(
  star: number,
  clarity: number,
  technical: number,
  confidence: number
): string[] {
  const strengths: string[] = [];

  if (technical >= 80) strengths.push("Strong technical foundation");
  if (clarity >= 80) strengths.push("Clear communication and articulation");
  if (star >= 75) strengths.push("Good use of structured examples");
  if (confidence >= 75) strengths.push("Confident and composed delivery");

  if (strengths.length === 0) {
    strengths.push("Good problem-solving approach");
  }

  return strengths.slice(0, 3);
}

function generateImprovements(
  star: number,
  clarity: number,
  technical: number,
  confidence: number
): string[] {
  const improvements: string[] = [];

  if (star < 75) improvements.push("Use STAR method more consistently");
  if (clarity < 80) improvements.push("Provide more specific, quantifiable results");
  if (technical < 75) improvements.push("Deepen technical knowledge in key areas");
  if (confidence < 75) improvements.push("Speak more deliberately and with confidence");

  if (improvements.length === 0) {
    improvements.push("Add more measurable outcomes to examples");
  }

  return improvements.slice(0, 3);
}

function generateRecommendations(
  star: number,
  clarity: number,
  technical: number
): string[] {
  return [
    "Practice the STAR framework: Situation, Task, Action, Result",
    "Include specific metrics and business impact in your answers",
    "Record yourself and review for pace, clarity, and filler words",
    "Research company-specific technical challenges and prepare examples",
  ];
}
