import { auth } from "@clerk/nextjs/server";
import { aiErrorMessage } from "@/lib/ai-client";
import { blockNonJobSeeker } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { loadJobContext, isContextError } from "@/lib/job-context";
import { tailorResume } from "@/lib/ai-content";
import { fillExperienceDates } from "@/lib/resume-dates";
import { deductTokens, addTokens, TOKEN_COSTS } from "@/lib/tokens";

// GET /api/jobs/[jobId]/tailor — fetch saved tailored resume
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;
  const { jobId } = await params;

  const { data } = await supabaseAdmin
    .from("tailored_resumes")
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ data: data ?? null });
}

// POST /api/jobs/[jobId]/tailor — generate a tailored resume
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;
  const { jobId } = await params;

  const body = await req.json().catch(() => ({}));
  const detail: "concise" | "expanded" = body.detail === "expanded" ? "expanded" : "concise";
  const ctx = await loadJobContext(userId, jobId, body.resume_version_id);
  if (isContextError(ctx)) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  // Reserve tokens ATOMICALLY before doing the paid LLM work. deductTokens does
  // a conditional balance update, so concurrent requests can't both pass — only
  // one reservation of `cost` wins, closing the "fire N concurrent, all get the
  // result, only one is charged" race. Refunded below if the work fails.
  const cost = TOKEN_COSTS.resume_tailor;
  const reservation = await deductTokens(userId, cost, "resume_tailor", { jobId }, { meterFree: true });
  if (!reservation.ok) {
    return NextResponse.json(
      { error: `You're out of tokens. Tailoring a résumé costs ${cost} and you have ${reservation.balance}. Upgrade your plan or top up to continue.`, upgrade_required: true, balance: reservation.balance },
      { status: 402 }
    );
  }

  let result;
  try {
    result = await tailorResume(ctx.resumeProfile, ctx.jobParsed, detail, ctx.resumeRawText);
  } catch (err) {
    console.error("Tailoring error:", err);
    await addTokens(userId, cost, "resume_tailor_refund", { jobId, reason: "llm_error" });
    return NextResponse.json({ error: aiErrorMessage(err) }, { status: 500 });
  }

  // Backfill any dates the model dropped from the source resume.
  if (result.tailored_json?.experience) {
    result.tailored_json.experience = fillExperienceDates(
      result.tailored_json.experience,
      ctx.resumeProfile.experience ?? []
    );
  }

  const { data, error } = await supabaseAdmin
    .from("tailored_resumes")
    .upsert(
      {
        user_id: userId,
        job_id: jobId,
        source_resume_version_id: ctx.resumeVersionId,
        headline: result.headline ?? null,
        summary: result.summary ?? null,
        tailored_json: result.tailored_json ?? {},
        changes: result.changes ?? [],
        keywords_added: result.keywords_added ?? [],
      },
      { onConflict: "job_id,source_resume_version_id" }
    )
    .select("*")
    .single();

  if (error) {
    console.error("Tailor save error:", error.message);
    await addTokens(userId, cost, "resume_tailor_refund", { jobId, reason: "save_error" });
    return NextResponse.json({ error: "Couldn't save your tailored résumé. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ data, balance: reservation.balance });
}
