import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;

// GET /api/interviews/sessions/[sessionId]
// Get specific session with feedback and responses
export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { sessionId } = params;

  try {
    // Fetch session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("interview_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Fetch responses
    const { data: responses, error: responsesError } = await supabaseAdmin
      .from("interview_responses")
      .select("*")
      .eq("session_id", sessionId)
      .order("question_number");

    if (responsesError) throw responsesError;

    // Fetch feedback
    const { data: feedback, error: feedbackError } = await supabaseAdmin
      .from("interview_feedback")
      .select("*")
      .eq("session_id", sessionId)
      .single();

    if (feedbackError) throw feedbackError;

    return NextResponse.json({
      session,
      feedback,
      responses: responses || [],
    });
  } catch (err) {
    console.error("Fetch session error:", err);
    return NextResponse.json(
      { error: "Failed to fetch session" },
      { status: 500 }
    );
  }
}
