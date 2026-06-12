import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

// POST /api/enterprise/voice-screen/twiml?appId=xxx
// Called by Twilio when the candidate answers. Returns TwiML XML.
// Public endpoint — secured by the unguessable appId in query param.
export async function POST(req: NextRequest) {
  const appId = new URL(req.url).searchParams.get("appId");
  if (!appId) return twimlError("Configuration error. Goodbye.");

  const { data: app } = await supabaseAdmin
    .from("enterprise_applications")
    .select("candidate_name,voice_questions,job_id")
    .eq("id", appId)
    .maybeSingle();

  if (!app) return twimlError("Call configuration not found. Goodbye.");

  const questions: string[] = Array.isArray(app.voice_questions) ? (app.voice_questions as string[]) : [];
  const candidateName = (app.candidate_name as string).split(" ")[0];

  // Fetch org name
  const { data: job } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("title,org:enterprise_orgs(name)")
    .eq("id", app.job_id as string)
    .maybeSingle();

  const orgName = (job?.org as unknown as Record<string, unknown> | null)?.name as string ?? "the company";
  const jobTitle = job?.title ?? "this position";

  const recordingCallbackUrl = `${APP_URL}/api/enterprise/voice-screen/recording?appId=${encodeURIComponent(appId)}`;

  const questionScript = questions.length > 0
    ? questions.map((q, i) => `Question ${i + 1}: ${q}`).join("... ")
    : `Tell us why you are interested in the ${jobTitle} role and walk us through your relevant experience.`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna" language="en-US">
    Hello, ${candidateName}. Thank you for applying to ${orgName}.
    This is an automated screening call for the ${jobTitle} role.
    I will read you ${questions.length || 1} screening questions.
    After the beep, please answer all questions in order.
    You will have up to 3 minutes. Ready?
  </Say>
  <Pause length="1"/>
  <Say voice="Polly.Joanna" language="en-US">
    Here are your questions. ${questionScript}
  </Say>
  <Say voice="Polly.Joanna" language="en-US">
    Please begin your answers after the beep.
  </Say>
  <Record
    maxLength="180"
    playBeep="true"
    recordingStatusCallback="${recordingCallbackUrl}"
    recordingStatusCallbackMethod="POST"
    trim="trim-silence"
  />
  <Say voice="Polly.Joanna" language="en-US">
    Thank you for your time. We will review your answers and be in touch soon. Goodbye.
  </Say>
</Response>`;

  return new NextResponse(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
}

function twimlError(message: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${message}</Say></Response>`,
    { headers: { "Content-Type": "text/xml" } },
  );
}
