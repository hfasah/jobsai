import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Public: get interview data by token
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: interview } = await supabaseAdmin
    .from("enterprise_interviews")
    .select("*, application:enterprise_applications(candidate_name, candidate_email), job:enterprise_jobs(title, department, location)")
    .eq("token", token)
    .maybeSingle();

  if (!interview) return NextResponse.json({ error: "Interview not found." }, { status: 404 });
  if (new Date(interview.expires_at) < new Date()) {
    await supabaseAdmin.from("enterprise_interviews").update({ status: "expired" }).eq("id", interview.id);
    return NextResponse.json({ error: "This interview link has expired." }, { status: 410 });
  }
  if (interview.status === "completed") return NextResponse.json({ error: "Interview already completed." }, { status: 409 });

  const { data: kit } = await supabaseAdmin
    .from("enterprise_interview_kits")
    .select("questions")
    .eq("job_id", interview.job_id)
    .maybeSingle();

  if (!kit) return NextResponse.json({ error: "Interview kit not found." }, { status: 404 });

  // Don't send rubrics to candidate
  const questions = (kit.questions as Array<{ id: string; type: string; question: string; rubric: string; max_score: number }>)
    .map(({ id, type, question, max_score }) => ({ id, type, question, max_score }));

  return NextResponse.json({
    data: {
      id: interview.id,
      status: interview.status,
      candidate_name: (interview.application as { candidate_name: string } | null)?.candidate_name,
      job_title: (interview.job as { title: string } | null)?.title,
      questions,
      expires_at: interview.expires_at,
    },
  });
}
