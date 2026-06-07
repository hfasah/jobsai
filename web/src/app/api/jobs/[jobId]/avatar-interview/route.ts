import { auth } from "@clerk/nextjs/server";
import { blockNonJobSeeker } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { loadJobContext, isContextError } from "@/lib/job-context";
import { supabaseAdmin } from "@/lib/supabase";
import { deductTokens, getTokenBalance, TOKEN_COSTS } from "@/lib/tokens";
import { checkInterviewAccess } from "@/lib/feature-access";
import { getUserPlan } from "@/lib/billing";
import { PERSONAS, INTERVIEWER_GUARDRAILS, INTERVIEW_TOOL_GUARDRAILS, type AvatarPersona } from "@/lib/avatar";

export const maxDuration = 60;

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

export interface Turn {
  role: "interviewer" | "candidate";
  content: string;
}

// Optional client-measured webcam metrics (eye contact / presence / steadiness).
export interface BodyLanguage {
  eye_contact: number | null;  // 0–100, % of samples with a centered face
  presence: number | null;     // 0–100, % of samples a face was detected
  steadiness: number | null;   // 0–100, framing stability
  available: boolean;          // false when the browser couldn't analyze
}

export interface AvatarAnalysis {
  overall: number;          // 1–5
  communication: number;
  technical: number;
  behavioral: number;
  confidence: number;
  presence_score: number;   // derived from body language + confidence
  body_language: BodyLanguage;
  speaking_pace: { wpm: number; label: string };
  filler_words: { count: number; per_min: number; examples: string[] };
  summary: string;
  strengths: string[];
  improvements: string[];
}

const MAX_MAIN = 5;   // distinct main questions (follow-ups don't count against this)
const MAX_TOTAL = 9;  // hard cap on interviewer turns (mains + follow-ups)
const PER_TURN_COST = TOKEN_COSTS.avatar_minute;

const FILLERS = ["um", "uh", "er", "like", "you know", "basically", "actually", "literally", "kind of", "sort of", "i mean"];

function analyzeSpeech(transcript: string, durationSec: number) {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const minutes = Math.max(durationSec / 60, 0.1);
  const wpm = Math.round(words.length / minutes);
  const lower = ` ${transcript.toLowerCase()} `;
  let count = 0;
  const examples: string[] = [];
  for (const f of FILLERS) {
    const re = new RegExp(`\\b${f.replace(/ /g, "\\s+")}\\b`, "g");
    const m = lower.match(re);
    if (m?.length) { count += m.length; if (!examples.includes(f)) examples.push(f); }
  }
  const label = wpm < 110 ? "A bit slow" : wpm > 170 ? "Rushed" : "Natural";
  return { wpm, label, filler: { count, per_min: Math.round((count / minutes) * 10) / 10, examples: examples.slice(0, 5) } };
}

function personaMeta(p: unknown) {
  const key = (p as AvatarPersona) in PERSONAS ? (p as AvatarPersona) : "hiring_manager";
  return PERSONAS[key];
}

// POST /api/jobs/[jobId]/avatar-interview
//  • { action: "start", persona }
//  • { action: "respond", persona, history, turn }
//  • { action: "analyze", persona, history, duration_sec, body_language, tokens_spent }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;

  const { jobId } = await params;
  const body = await req.json().catch(() => ({}));
  const action = body.action as "start" | "respond" | "analyze";
  const persona = personaMeta(body.persona);

  // ── Start ────────────────────────────────────────────────────────────────────
  if (action === "start") {
    const access = await checkInterviewAccess(userId, "avatar");
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason, upgrade_required: true }, { status: 403 });
    }

    const balance = await getTokenBalance(userId);
    if (balance < PER_TURN_COST) {
      return NextResponse.json(
        { error: `Avatar interviews cost ${PER_TURN_COST} tokens per question and you have ${balance}. Upgrade or top up to start.`, upgrade_required: true, balance },
        { status: 402 }
      );
    }

    const ctx = await loadJobContext(userId, jobId);
    if (isContextError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const jobTitle = ctx.jobParsed.title ?? "the role";
    const company = ctx.jobParsed.company ?? "the company";
    const resumeName = ctx.resumeProfile.name ?? "the candidate";

    let question: string;
    try {
      const r = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        temperature: 0.7,
        messages: [
          { role: "system", content: `${persona.guidance} You are interviewing for a ${jobTitle} role at ${company}. You are on a live video call speaking out loud — keep each question to 1–2 conversational sentences, ONE question at a time. ${INTERVIEWER_GUARDRAILS} Return ONLY the spoken question text.` },
          { role: "user", content: `Greet ${resumeName} briefly and ask your first question.` },
        ],
      });
      question = r.choices[0]?.message?.content?.trim() || "Thanks for joining — to start, tell me a bit about yourself and why this role.";
    } catch (err) {
      console.error("avatar start error:", err);
      return NextResponse.json({ error: "Could not start the interview." }, { status: 500 });
    }

    // Free users get a short, metered preview (the opening question ≈ 10s), then
    // an upgrade wall on their first answer. meterFree consumes the 500 grant.
    const spend = await deductTokens(userId, PER_TURN_COST, "avatar_minute", { jobId, turn: 0 }, { meterFree: true });
    return NextResponse.json({ data: { question, balance: spend.balance, trial: access.trial ?? false, voice: persona.voice } });
  }

  // ── Respond (acknowledge + adaptive follow-up or next main question) ──────────
  if (action === "respond") {
    const history: Turn[] = Array.isArray(body.history) ? body.history : [];
    const mainCount = typeof body.main_count === "number" ? body.main_count : history.filter((t) => t.role === "interviewer").length;
    const followupJustAsked = body.followup_just_asked === true;
    const totalTurns = typeof body.total_turns === "number" ? body.total_turns : history.filter((t) => t.role === "interviewer").length;

    // Free preview ends after the opening question — upgrade to continue.
    const plan = await getUserPlan(userId);
    if (plan === "free") {
      return NextResponse.json({
        data: {
          done: true,
          preview_over: true,
          message: "That was your free avatar preview — upgrade to run the full AI avatar interview with live feedback.",
        },
      });
    }

    const canFollowup = !followupJustAsked && totalTurns < MAX_TOTAL;
    const canNewMain = mainCount < MAX_MAIN && totalTurns < MAX_TOTAL;
    if (!canFollowup && !canNewMain) return NextResponse.json({ data: { done: true } });

    const balance = await getTokenBalance(userId);
    if (balance < PER_TURN_COST) {
      return NextResponse.json({ error: "You're out of tokens. Wrap up to see your analysis.", upgrade_required: true, balance, done: true }, { status: 402 });
    }

    const ctx = await loadJobContext(userId, jobId);
    if (isContextError(ctx)) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const jobTitle = ctx.jobParsed.title ?? "the role";
    const convo = history.map((t) => `${t.role === "interviewer" ? "Interviewer" : "Candidate"}: ${t.content}`).join("\n");

    let directive: string;
    if (canNewMain && canFollowup) {
      directive = `If the candidate's last answer was vague, incomplete, or especially worth exploring, ask ONE probing follow-up about a specific detail (set kind to "followup"). Otherwise move on to a new main question on a fresh topic (set kind to "question").`;
    } else if (canNewMain && !canFollowup) {
      directive = `You just asked a follow-up, so now ask a NEW main question on a fresh topic (set kind to "question"). Do not ask another follow-up.`;
    } else {
      directive = `You've covered all the main topics. If the last answer is genuinely worth probing, ask ONE final follow-up (set kind to "followup"); otherwise set "wrap" to true to end the interview.`;
    }

    let parsed: { say?: string; kind?: "followup" | "question"; wrap?: boolean };
    try {
      const r = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${persona.guidance} You are interviewing for a ${jobTitle} role on a live video call. ALWAYS first briefly and naturally acknowledge the candidate's last answer in a few words (e.g. "Got it.", "That makes sense.", "Interesting —"), THEN ask exactly ONE question. Keep the whole thing to 1–2 spoken sentences. ${directive} ${INTERVIEWER_GUARDRAILS} Return ONLY JSON: {"say":"<short acknowledgment + your spoken question>","kind":"followup"|"question","wrap":<true|false>}` },
          { role: "user", content: `Conversation so far:\n${convo}` },
        ],
      });
      parsed = JSON.parse(r.choices[0]?.message?.content || "{}");
    } catch (err) {
      console.error("avatar respond error:", err);
      return NextResponse.json({ error: "Could not generate the next question." }, { status: 500 });
    }

    if (parsed.wrap || !parsed.say) return NextResponse.json({ data: { done: true } });

    const kind: "followup" | "question" = !canNewMain ? "followup" : !canFollowup ? "question" : (parsed.kind === "followup" ? "followup" : "question");

    const spend = await deductTokens(userId, PER_TURN_COST, "avatar_minute", { jobId, turn: totalTurns, kind });
    return NextResponse.json({ data: { question: parsed.say, kind, balance: spend.balance, done: false } });
  }

  // ── Analyze ──────────────────────────────────────────────────────────────────
  if (action === "analyze") {
    const history: Turn[] = Array.isArray(body.history) ? body.history : [];
    const durationSec = typeof body.duration_sec === "number" ? body.duration_sec : 0;
    const bl: BodyLanguage = body.body_language ?? { eye_contact: null, presence: null, steadiness: null, available: false };
    const candidateText = history.filter((t) => t.role === "candidate").map((t) => t.content).join(" ");
    const speech = analyzeSpeech(candidateText, durationSec);

    const ctx = await loadJobContext(userId, jobId);
    const jobTitle = isContextError(ctx) ? "the role" : (ctx.jobParsed.title ?? "the role");
    const jobFocus = isContextError(ctx) ? "" : [
      ...(ctx.jobParsed.skills ?? []).slice(0, 8),
      ...(ctx.jobParsed.requirements ?? []).slice(0, 4),
    ].filter(Boolean).join(", ");
    const convo = history.map((t) => `${t.role === "interviewer" ? "Interviewer" : "Candidate"}: ${t.content}`).join("\n");

    let scores: { communication: number; technical: number; behavioral: number; confidence: number; summary: string; strengths: string[]; improvements: string[] };
    try {
      const r = await getOpenAI().chat.completions.create({
        model: "gpt-4o",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `You are a senior interview coach writing a candidate's debrief after a video interview (${persona.label}) for a ${jobTitle} role.${jobFocus ? ` This role emphasizes: ${jobFocus}.` : ""} Score honestly and give specific, role-relevant feedback grounded in what the candidate actually said. ${INTERVIEW_TOOL_GUARDRAILS} Return ONLY valid JSON:
{ "communication": <0-100>, "technical": <0-100>, "behavioral": <0-100>, "confidence": <0-100>,
  "summary": "<a 3-4 sentence written assessment: overall impression, how well they came across for THIS role, and the single most important thing to improve>",
  "strengths": ["<2-3 specific strengths, each tied to something they actually said>"],
  "improvements": ["<3-4 concrete, actionable things to work on for THIS role — reference the role's focus areas and give real advice, not just observations>"] }` },
          { role: "user", content: `Full transcript:\n${convo}` },
        ],
      });
      scores = JSON.parse(r.choices[0]?.message?.content || "{}");
    } catch (err) {
      console.error("avatar analyze error:", err);
      return NextResponse.json({ error: "Analysis failed." }, { status: 500 });
    }

    const dims = [scores.communication, scores.technical, scores.behavioral, scores.confidence].filter((n) => typeof n === "number");
    const overall = dims.length ? Math.round((dims.reduce((a, b) => a + b, 0) / dims.length) / 20 * 10) / 10 : 0;

    // Presence blends confidence with measured eye-contact/presence when available.
    const presenceParts = [scores.confidence, bl.eye_contact, bl.presence].filter((n): n is number => typeof n === "number");
    const presence_score = presenceParts.length ? Math.round(presenceParts.reduce((a, b) => a + b, 0) / presenceParts.length) : (scores.confidence ?? 0);

    const analysis: AvatarAnalysis = {
      overall,
      communication: scores.communication ?? 0,
      technical: scores.technical ?? 0,
      behavioral: scores.behavioral ?? 0,
      confidence: scores.confidence ?? 0,
      presence_score,
      body_language: bl,
      speaking_pace: { wpm: speech.wpm, label: speech.label },
      filler_words: speech.filler,
      summary: scores.summary ?? "",
      strengths: scores.strengths ?? [],
      improvements: scores.improvements ?? [],
    };

    try {
      await supabaseAdmin.from("interview_sessions").insert({
        user_id: userId,
        job_id: jobId,
        mode: "avatar",
        interview_type: String(body.persona ?? "hiring_manager"),
        overall_score: overall,
        subscores: {
          communication: analysis.communication,
          technical: analysis.technical,
          behavioral: analysis.behavioral,
          confidence: analysis.confidence,
          presence: presence_score,
          eye_contact: bl.eye_contact,
          wpm: speech.wpm,
          filler_count: speech.filler.count,
        },
        question_count: history.filter((t) => t.role === "interviewer").length,
        tokens_spent: typeof body.tokens_spent === "number" ? body.tokens_spent : 0,
      });
    } catch (err) {
      console.error("avatar session persist failed:", err);
    }

    return NextResponse.json({ data: analysis });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
