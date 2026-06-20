import { auth } from "@clerk/nextjs/server";
import { blockNonJobSeeker } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { loadJobContext, isContextError } from "@/lib/job-context";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;

export type FollowUpType = "follow_up" | "thank_you" | "check_in";

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = getAIClient(AI_TIERS.smart.provider);
  return _openai;
}

const TYPE_PROMPTS: Record<FollowUpType, string> = {
  follow_up: `Write a brief, professional follow-up email from a candidate who applied for this role and hasn't heard back.
Tone: warm, confident, non-pushy. Under 120 words. Reiterate interest and offer to provide anything additional.`,

  thank_you: `Write a brief, genuine thank-you email from a candidate who just completed an interview for this role.
Tone: warm, enthusiastic but professional. Under 120 words. Thank the interviewer(s), reiterate interest, highlight one specific strength relevant to the role.`,

  check_in: `Write a polite check-in email from a candidate who applied some time ago and hasn't received any response.
Tone: understanding, professional, persistent but not annoying. Under 100 words. Acknowledge the hiring process takes time, restate interest, ask if they need anything else.`,
};

// POST /api/jobs/[jobId]/follow-up
// Body: { type: FollowUpType }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;

  const { jobId } = await params;
  const body = await req.json().catch(() => ({}));
  const type = (body.type ?? "follow_up") as FollowUpType;

  if (!["follow_up", "thank_you", "check_in"].includes(type)) {
    return NextResponse.json({ error: "Invalid type." }, { status: 400 });
  }

  const ctx = await loadJobContext(userId, jobId);
  if (isContextError(ctx)) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  // Fetch applicant name from apply profile
  const { data: profile } = await supabaseAdmin
    .from("apply_profiles")
    .select("first_name, last_name")
    .eq("user_id", userId)
    .maybeSingle();

  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") ||
    ctx.resumeProfile.name || "the candidate";

  const title = ctx.jobParsed.title ?? "the role";
  const company = ctx.jobParsed.company ?? "your company";
  const skills = (ctx.jobParsed.skills ?? []).slice(0, 6).join(", ");

  const systemPrompt = `You are a professional career coach writing job application emails on behalf of a candidate.
Return ONLY a valid JSON object: { "subject": "...", "body": "..." }
- subject: concise, professional email subject line
- body: the full email body, plain text, no markdown, no placeholders like [Name]
- Sign the email with the candidate's name
- Keep it genuine and specific to the role`;

  const userPrompt = `Candidate name: ${name}
Role: ${title} at ${company}
Relevant skills: ${skills || "not specified"}

Task: ${TYPE_PROMPTS[type]}`;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: AI_TIERS.smart.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response");

    const result = JSON.parse(content) as { subject: string; body: string };
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("Follow-up generation error:", err);
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }
}
