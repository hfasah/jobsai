import { auth } from "@clerk/nextjs/server";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { generateScreeningQuestions, initiateVoiceCall, voiceConfigured } from "@/lib/voice-screen";

export const maxDuration = 30;

// POST /api/enterprise/voice-screen/call
// body: { appId: string }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "ai_interviews");
  if (gate) return gate;

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  if (!voiceConfigured()) {
    return NextResponse.json({ error: "Voice screening requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER." }, { status: 422 });
  }

  const { appId } = await req.json().catch(() => ({}));
  if (!appId) return NextResponse.json({ error: "appId required." }, { status: 400 });

  const { data: app } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id,candidate_name,candidate_phone,job_id,org_id,voice_screen_status")
    .eq("id", appId)
    .eq("org_id", org.id)
    .maybeSingle();

  if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404 });

  const phone = (app as Record<string, unknown>).candidate_phone as string | null;
  if (!phone) return NextResponse.json({ error: "Candidate has no phone number on file." }, { status: 422 });

  if (["calling", "processing"].includes((app as Record<string, unknown>).voice_screen_status as string ?? "")) {
    return NextResponse.json({ error: "Voice screen already in progress." }, { status: 409 });
  }

  // Fetch job for question generation
  const { data: job } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("title,description,qualifications")
    .eq("id", app.job_id as string)
    .maybeSingle();

  const jobTitle = job?.title ?? "this position";
  const jobDesc = [job?.description, job?.qualifications].filter(Boolean).join(" ");

  // Generate role-specific questions
  const questions = await generateScreeningQuestions(jobTitle, jobDesc);

  // Mark as pending + store questions before calling
  await supabaseAdmin
    .from("enterprise_applications")
    .update({
      voice_screen_status: "calling",
      voice_questions: questions,
      voice_screened_at: new Date().toISOString(),
    })
    .eq("id", appId);

  // Initiate Twilio call
  let callSid: string;
  try {
    ({ callSid } = await initiateVoiceCall(phone, appId));
  } catch (err) {
    await supabaseAdmin
      .from("enterprise_applications")
      .update({ voice_screen_status: "failed" })
      .eq("id", appId);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  await supabaseAdmin
    .from("enterprise_applications")
    .update({ voice_call_sid: callSid })
    .eq("id", appId);

  return NextResponse.json({ ok: true, call_sid: callSid });
}
