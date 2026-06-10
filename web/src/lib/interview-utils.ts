// Utilities for saving interview sessions and tracking feedback

interface InterviewResponse {
  question_number: number;
  question: string;
  user_answer: string;
  star_score: number;
  clarity_score: number;
  technical_score: number;
  confidence_score: number;
  ai_feedback: string;
}

interface SaveSessionRequest {
  job_title?: string;
  job_description?: string;
  mode: "voice" | "avatar" | "text";
  responses: InterviewResponse[];
}

/**
 * Save interview session and generate feedback
 * Returns the session ID for redirecting to results page
 */
export async function saveInterviewSession(
  data: SaveSessionRequest
): Promise<string> {
  const res = await fetch("/api/interviews/save-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to save interview session");
  }

  const result = await res.json();
  return result.session_id;
}

/**
 * Convert voice interview analysis to feedback responses
 * Scores are already 0-100 from the voice analysis API
 */
export function convertVoiceAnalysisToResponses(
  turns: Array<{
    question: string;
    answer: string;
    analysis?: {
      communication: number;
      technical: number;
      behavioral: number;
      confidence: number;
      feedback?: string;
    };
  }>
): InterviewResponse[] {
  return turns.map((turn, idx) => {
    // Convert 0-5 scale to 0-100 if needed, or use provided scores
    const comm = (turn.analysis?.communication ?? 3) * 20; // 0-5 → 0-100
    const tech = (turn.analysis?.technical ?? 3) * 20;
    const behavioral = (turn.analysis?.behavioral ?? 3) * 20;
    const conf = (turn.analysis?.confidence ?? 3) * 20;

    // STAR score based on behavioral score (how well they structured the answer)
    const starScore = behavioral;

    return {
      question_number: idx + 1,
      question: turn.question,
      user_answer: turn.answer,
      star_score: starScore,
      clarity_score: comm,
      technical_score: tech,
      confidence_score: conf,
      ai_feedback: turn.analysis?.feedback || "Good answer. Continue to focus on the STAR method.",
    };
  });
}

/**
 * Convert avatar/text interview analysis to responses
 */
export function convertInterviewAnalysisToResponses(
  history: Array<{
    question: string;
    answer: string;
    scores?: {
      star?: number;
      clarity?: number;
      technical?: number;
      confidence?: number;
    };
    feedback?: string;
  }>
): InterviewResponse[] {
  return history.map((item, idx) => ({
    question_number: idx + 1,
    question: item.question,
    user_answer: item.answer,
    star_score: item.scores?.star ?? 75,
    clarity_score: item.scores?.clarity ?? 75,
    technical_score: item.scores?.technical ?? 75,
    confidence_score: item.scores?.confidence ?? 75,
    ai_feedback: item.feedback || "Good response.",
  }));
}
