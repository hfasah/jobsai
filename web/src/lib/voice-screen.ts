// AI Voice Screening — Twilio Voice + OpenAI Whisper/GPT helpers
import OpenAI from "openai";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

// Chat helpers run on the configurable "fast" tier.
let _ai: OpenAI | null = null;
const ai = () => (_ai ??= getAIClient(AI_TIERS.fast.provider));

// ── Question generation ───────────────────────────────────────────────────────

export async function generateScreeningQuestions(
  jobTitle: string,
  jobDescription: string,
): Promise<string[]> {
  const res = await ai().chat.completions.create({
    model: AI_TIERS.fast.model,
    max_tokens: 400,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: `Generate 4 concise phone screening questions for a ${jobTitle} role.
Job description excerpt: "${jobDescription.slice(0, 500)}"

Focus on: motivation, relevant experience, key skills, availability.
Keep each question under 20 words — it will be read aloud by text-to-speech.

Return: { "questions": ["q1", "q2", "q3", "q4"] }`,
      },
    ],
  });
  try {
    const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}");
    return Array.isArray(parsed.questions) ? parsed.questions.slice(0, 4) : defaultQuestions(jobTitle);
  } catch {
    return defaultQuestions(jobTitle);
  }
}

function defaultQuestions(jobTitle: string): string[] {
  return [
    `What interests you most about this ${jobTitle} role?`,
    "Can you walk me through your most relevant experience for this position?",
    "What is your current or expected availability to start?",
    "Do you have any questions about the role or the company?",
  ];
}

// ── Twilio Voice outbound call ────────────────────────────────────────────────

function twilioBase() {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  return {
    url: `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
    auth: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
  };
}

export async function initiateVoiceCall(
  to: string,
  appId: string,
): Promise<{ callSid: string }> {
  const from = process.env.TWILIO_PHONE_NUMBER!;
  const twimlUrl = `${APP_URL}/api/enterprise/voice-screen/twiml?appId=${encodeURIComponent(appId)}`;

  const { url, auth } = twilioBase();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Url: twimlUrl, Method: "POST" }).toString(),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.message ?? `Twilio error ${res.status}`);
  return { callSid: json.sid };
}

// ── Recording transcription + scoring ────────────────────────────────────────

export async function transcribeRecording(recordingUrl: string): Promise<string> {
  // Append .mp3 so Twilio returns the audio file directly
  const audioUrl = recordingUrl.endsWith(".mp3") ? recordingUrl : `${recordingUrl}.mp3`;

  // Twilio requires auth to download recordings
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const auth = `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`;

  const audioRes = await fetch(audioUrl, { headers: { Authorization: auth } });
  if (!audioRes.ok) throw new Error(`Failed to download recording: ${audioRes.status}`);

  const audioBuffer = await audioRes.arrayBuffer();
  const file = new File([audioBuffer], "recording.mp3", { type: "audio/mpeg" });

  // Whisper transcription is OpenAI-only — pin the provider so a fast-tier
  // switch (e.g. DeepSeek) doesn't break audio transcription.
  const transcription = await getAIClient("openai").audio.transcriptions.create({
    model: "whisper-1",
    file,
    language: "en",
  });
  return transcription.text;
}

export async function scoreVoiceInterview(
  candidateName: string,
  jobTitle: string,
  questions: string[],
  transcript: string,
): Promise<{
  voice_score: number;
  voice_summary: string;
  voice_recommendation: "advance" | "hold" | "reject";
  voice_strengths: string[];
  voice_concerns: string[];
}> {
  const res = await ai().chat.completions.create({
    model: AI_TIERS.fast.model,
    max_tokens: 600,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: `You are a recruitment specialist reviewing a voice screening call transcript.

Candidate: ${candidateName}
Role: ${jobTitle}

Screening questions asked:
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Candidate's transcript:
"${transcript.slice(0, 2000)}"

Evaluate the candidate and return JSON:
{
  "voice_score": 0-100,
  "voice_summary": "2-3 sentence summary of how the candidate came across",
  "voice_recommendation": "advance" | "hold" | "reject",
  "voice_strengths": ["strength 1", "strength 2"],
  "voice_concerns": ["concern 1", "concern 2"]
}`,
      },
    ],
  });

  const parsed = JSON.parse(res.choices[0]?.message?.content ?? "{}");
  return {
    voice_score: parsed.voice_score ?? 50,
    voice_summary: parsed.voice_summary ?? "No summary available.",
    voice_recommendation: parsed.voice_recommendation ?? "hold",
    voice_strengths: parsed.voice_strengths ?? [],
    voice_concerns: parsed.voice_concerns ?? [],
  };
}

export function voiceConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  );
}
