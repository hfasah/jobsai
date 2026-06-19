import { auth } from "@clerk/nextjs/server";
import { blockNonJobSeeker } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { loadJobContext, isContextError } from "@/lib/job-context";
import { detectGaps, scanATS } from "@/lib/ai-content";
import { getTokenAccount, deductTokens, TOKEN_COSTS } from "@/lib/tokens";

// POST /api/jobs/[jobId]/elicit — resume intake interview (Phase 2).
// Returns recruiter-style questions that surface the candidate's real specifics.
// Gated by ATS signal: strong resumes don't need an interrogation, so we skip the
// (paid) gap-detection call for them. Answers are collected/stored in Phase 3.

// A resume is worth eliciting when it's not already strong: below the score gate,
// OR carrying buzzwords, OR with a non-trivial weakness.
const ELICIT_GATE_MIN_SCORE = 85;

interface GateSignal {
  score: number;
  weaknesses: { severity?: string }[];
  buzzwords: unknown[];
}

function needsElicitation(g: GateSignal): boolean {
  if (g.score < ELICIT_GATE_MIN_SCORE) return true;
  if ((g.buzzwords?.length ?? 0) > 0) return true;
  if ((g.weaknesses ?? []).some((w) => w?.severity && w.severity !== "low")) return true;
  return false;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;
  const { jobId } = await params;

  const body = await req.json().catch(() => ({}));
  const ctx = await loadJobContext(userId, jobId, body.resume_version_id);
  if (isContextError(ctx)) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  // ── ATS gate ──────────────────────────────────────────────────────────────
  // Reuse the latest stored scan for this resume+job when present (free); only
  // run a fresh scan when we have none. If scanning fails, don't block intake —
  // fall through to eliciting.
  let gate: GateSignal | null = null;
  const { data: priorScan } = await supabaseAdmin
    .from("ats_scans")
    .select("score, weaknesses, buzzwords")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .eq("resume_version_id", ctx.resumeVersionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (priorScan) {
    gate = {
      score: priorScan.score ?? 0,
      weaknesses: (priorScan.weaknesses ?? []) as GateSignal["weaknesses"],
      buzzwords: (priorScan.buzzwords ?? []) as unknown[],
    };
  } else {
    try {
      const ats = await scanATS(ctx.resumeProfile, ctx.jobParsed, ctx.resumeRawText ?? undefined);
      gate = { score: ats.score, weaknesses: ats.weaknesses ?? [], buzzwords: ats.buzzwords ?? [] };
    } catch (err) {
      console.error("Elicit ATS gate scan failed (proceeding):", err);
    }
  }

  const score = gate?.score ?? null;
  // No gate signal → proceed (better to ask than to wrongly skip).
  if (gate && !needsElicitation(gate)) {
    return NextResponse.json({ data: { gated: true, score, questions: [] } });
  }

  // ── Token gate (only charged when we actually run gap detection) ────────────
  const cost = TOKEN_COSTS.resume_intake;
  const account = await getTokenAccount(userId);
  if (account.balance < cost) {
    return NextResponse.json(
      { error: `You're out of tokens. A resume intake costs ${cost} and you have ${account.balance}. Upgrade your plan or top up to continue.`, upgrade_required: true, balance: account.balance },
      { status: 402 }
    );
  }

  let result;
  try {
    result = await detectGaps(ctx.resumeProfile, ctx.jobParsed);
  } catch (err) {
    console.error("Resume intake (detectGaps) error:", err);
    return NextResponse.json({ error: "Couldn't analyze your resume. Please try again." }, { status: 500 });
  }

  // Nothing to ask → don't charge.
  if (result.questions.length === 0) {
    return NextResponse.json({ data: { gated: true, score, questions: [] } });
  }

  const spend = await deductTokens(userId, cost, "resume_intake", { jobId }, { meterFree: true });
  return NextResponse.json({
    data: { gated: false, score, questions: result.questions },
    balance: spend.balance,
  });
}
