import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { transcribeRecording, scoreVoiceInterview } from "@/lib/voice-screen";

export const maxDuration = 60;

// POST /api/enterprise/voice-screen/recording?appId=xxx
// Twilio RecordingStatusCallback — fires when recording is available.
// Public endpoint secured by appId in query param.
export async function POST(req: NextRequest) {
  const appId = new URL(req.url).searchParams.get("appId");
  if (!appId) return NextResponse.json({ error: "Missing appId" }, { status: 400 });

  const body = await req.formData().catch(() => null);
  const recordingUrl = body?.get("RecordingUrl") as string | null;
  const recordingStatus = body?.get("RecordingStatus") as string | null;

  if (recordingStatus !== "completed" || !recordingUrl) {
    return NextResponse.json({ ok: true });
  }

  // Mark as processing
  await supabaseAdmin
    .from("enterprise_applications")
    .update({ voice_screen_status: "processing", voice_recording_url: recordingUrl })
    .eq("id", appId);

  const { data: app } = await supabaseAdmin
    .from("enterprise_applications")
    .select("candidate_name,voice_questions,job_id")
    .eq("id", appId)
    .maybeSingle();

  if (!app) return NextResponse.json({ error: "App not found" }, { status: 404 });

  const questions: string[] = Array.isArray(app.voice_questions) ? (app.voice_questions as string[]) : [];
  const candidateName = app.candidate_name as string;

  const { data: job } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("title")
    .eq("id", app.job_id as string)
    .maybeSingle();

  const jobTitle = job?.title ?? "this position";

  try {
    const transcript = await transcribeRecording(recordingUrl);
    const scores = await scoreVoiceInterview(candidateName, jobTitle, questions, transcript);

    await supabaseAdmin
      .from("enterprise_applications")
      .update({
        voice_screen_status: "complete",
        voice_transcript: transcript,
        voice_score: scores.voice_score,
        voice_summary: scores.voice_summary,
        voice_recommendation: scores.voice_recommendation,
        voice_strengths: scores.voice_strengths,
        voice_concerns: scores.voice_concerns,
      })
      .eq("id", appId);
  } catch (err) {
    console.error("Voice screen processing error:", err);
    await supabaseAdmin
      .from("enterprise_applications")
      .update({ voice_screen_status: "failed" })
      .eq("id", appId);
  }

  return NextResponse.json({ ok: true });
}
