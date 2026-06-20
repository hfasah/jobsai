import { auth } from "@clerk/nextjs/server";
import { blockNonJobSeeker } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAIClient, aiErrorMessage } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { supabaseAdmin } from "@/lib/supabase";
import { INTERVIEW_TOOL_GUARDRAILS } from "@/lib/avatar";

export const maxDuration = 30;

export interface BuddyCoaching {
  score: 1 | 2 | 3 | 4 | 5;
  strength: string;
  improvement: string;
  missed_points: string[];
  strong_phrases: string[];
  follow_up_prep: string;
}

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = getAIClient(AI_TIERS.smart.provider);
  return _openai;
}

// POST /api/jobs/[jobId]/interview-buddy
// Body: { transcript: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;

  const { jobId } = await params;
  const body = await req.json().catch(() => ({}));
  const transcript: string = (body.transcript ?? "").trim();

  if (!transcript || transcript.length < 10) {
    return NextResponse.json({ error: "Transcript too short." }, { status: 400 });
  }

  // Load job context for role-specific coaching
  const { data: jobRow } = await supabaseAdmin
    .from("jobs")
    .select("id, parsed:job_parsed(parsed_json)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (!jobRow) return NextResponse.json({ error: "Job not found." }, { status: 404 });

  const parsedRel = jobRow.parsed as { parsed_json: Record<string, unknown> }[] | { parsed_json: Record<string, unknown> } | null;
  const parsed = Array.isArray(parsedRel) ? parsedRel[0]?.parsed_json : parsedRel?.parsed_json;

  const title     = (parsed?.title    as string) ?? "the role";
  const company   = (parsed?.company  as string) ?? "the company";
  const skills    = ((parsed?.skills  as string[]) ?? []).slice(0, 8).join(", ");

  const systemPrompt = `You are a real-time interview coach. A candidate is in a live interview for ${title} at ${company}.
You receive a transcription of what they just said and provide instant coaching.
Key skills for the role: ${skills || "not specified"}

${INTERVIEW_TOOL_GUARDRAILS}

Return ONLY a valid JSON object:
{
  "score": <integer 1-5>,
  "strength": "<one sentence: what they did well>",
  "improvement": "<one sentence: single most important thing to improve>",
  "missed_points": ["<point they should have mentioned>"],
  "strong_phrases": ["<exact phrase or keyword they used well>"],
  "follow_up_prep": "<one sentence: likely follow-up question and quick hint>"
}
Rules:
- score: 1=poor, 2=weak, 3=decent, 4=good, 5=excellent
- missed_points: 0-2 items only; empty array if the answer was complete
- strong_phrases: 1-3 exact phrases from their transcript
- Be concise and actionable — they need to act on this in seconds`;

  const userPrompt = `Candidate's answer (transcribed from speech):
"${transcript}"

Rate and coach this answer.`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: AI_TIERS.smart.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    const coaching = JSON.parse(content) as BuddyCoaching;
    return NextResponse.json({ data: coaching });
  } catch (err) {
    console.error("Interview buddy error:", err);
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 500 });
  }
}
