import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAIClient } from "@/lib/ai-client";

export const maxDuration = 30;

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = getAIClient("openai");
  return _openai;
}

// POST /api/tts — { text, voice? } → audio/mpeg
// Used by the Voice Interviewer to speak questions in a natural voice.
// Metering is handled per-turn by the voice-interview route, so this only
// requires auth.
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = (body.text as string | undefined)?.slice(0, 1000)?.trim();
  const voice = (body.voice as string | undefined) ?? "onyx";
  // format "pcm" → base64 24kHz 16-bit mono PCM for LiveAvatar repeatAudio();
  // otherwise audio/mpeg for the simulated/voice player.
  const pcm = body.format === "pcm";

  if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });

  try {
    const speech = await getOpenAI().audio.speech.create({
      model: "tts-1",
      voice: voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
      input: text,
      response_format: pcm ? "pcm" : "mp3", // OpenAI "pcm" = 24kHz 16-bit mono
    });
    const buf = Buffer.from(await speech.arrayBuffer());

    if (pcm) {
      return NextResponse.json({ audio: buf.toString("base64") }, { headers: { "Cache-Control": "no-store" } });
    }
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("TTS error:", err);
    return NextResponse.json({ error: "Speech synthesis failed." }, { status: 500 });
  }
}
