import { auth } from "@clerk/nextjs/server";
import { aiErrorMessage } from "@/lib/ai-client";
import { blockNonJobSeeker } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { loadJobContext, isContextError } from "@/lib/job-context";
import { generateCoverLetter } from "@/lib/ai-content";
import { deductTokens, addTokens, TOKEN_COSTS } from "@/lib/tokens";
import type { CoverTone, CoverLength } from "@/types/phase3";

const TONES: CoverTone[] = ["professional", "enthusiastic", "confident", "warm", "concise"];
const LENGTHS: CoverLength[] = ["short", "medium", "long"];

// GET /api/jobs/[jobId]/cover-letter — fetch latest saved letter
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;
  const { jobId } = await params;

  const { data } = await supabaseAdmin
    .from("cover_letters")
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ data: data ?? null });
}

// POST /api/jobs/[jobId]/cover-letter  { tone?, length? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;
  const { jobId } = await params;

  const body = await req.json().catch(() => ({}));
  const tone: CoverTone = TONES.includes(body.tone) ? body.tone : "professional";
  const length: CoverLength = LENGTHS.includes(body.length) ? body.length : "medium";

  const ctx = await loadJobContext(userId, jobId, body.resume_version_id);
  if (isContextError(ctx)) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  // Reserve tokens ATOMICALLY before the paid LLM work (see tailor route for the
  // concurrency rationale). Refunded below if generation or save fails.
  const cost = TOKEN_COSTS.cover_letter;
  const reservation = await deductTokens(userId, cost, "cover_letter", { jobId }, { meterFree: true });
  if (!reservation.ok) {
    return NextResponse.json(
      { error: `You're out of tokens. A cover letter costs ${cost} and you have ${reservation.balance}. Upgrade your plan or top up to continue.`, upgrade_required: true, balance: reservation.balance },
      { status: 402 }
    );
  }

  let bodyText: string;
  try {
    bodyText = await generateCoverLetter(ctx.resumeProfile, ctx.jobParsed, tone, length);
  } catch (err) {
    console.error("Cover letter error:", err);
    await addTokens(userId, cost, "cover_letter_refund", { jobId, reason: "llm_error" });
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 500 });
  }

  // Replace the latest letter for this job (single saved letter per job for MVP)
  await supabaseAdmin.from("cover_letters").delete().eq("job_id", jobId).eq("user_id", userId);

  const { data, error } = await supabaseAdmin
    .from("cover_letters")
    .insert({
      user_id: userId,
      job_id: jobId,
      resume_version_id: ctx.resumeVersionId,
      tone,
      length,
      body: bodyText,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Cover letter save error:", error.message);
    await addTokens(userId, cost, "cover_letter_refund", { jobId, reason: "save_error" });
    return NextResponse.json({ error: "Couldn't save your cover letter. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ data, balance: reservation.balance });
}
