import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { loadJobContext, isContextError } from "@/lib/job-context";
import { scanATS } from "@/lib/ai-content";
import { getTokenAccount, deductTokens, TOKEN_COSTS } from "@/lib/tokens";

// GET /api/jobs/[jobId]/ats-scan — fetch the latest saved scan
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { jobId } = await params;

  const { data } = await supabaseAdmin
    .from("ats_scans")
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ data: data ?? null });
}

// POST /api/jobs/[jobId]/ats-scan — run a new scan against the primary resume
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { jobId } = await params;

  const body = await req.json().catch(() => ({}));
  const ctx = await loadJobContext(userId, jobId, body.resume_version_id);
  if (isContextError(ctx)) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  }

  // Token gate (all plans, incl. free's 500-token grant). Charged on success.
  const cost = TOKEN_COSTS.ats_scan;
  const account = await getTokenAccount(userId);
  if (account.balance < cost) {
    return NextResponse.json(
      { error: `You're out of tokens. An ATS scan costs ${cost} and you have ${account.balance}. Upgrade your plan or top up to continue.`, upgrade_required: true, balance: account.balance },
      { status: 402 }
    );
  }

  let result;
  try {
    result = await scanATS(ctx.resumeProfile, ctx.jobParsed, ctx.resumeRawText ?? undefined);
  } catch (err) {
    console.error("ATS scan error:", err);
    return NextResponse.json({ error: "Scan failed. Please try again." }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("ats_scans")
    .upsert(
      {
        user_id: userId,
        job_id: jobId,
        resume_version_id: ctx.resumeVersionId,
        score: result.score,
        summary: result.summary ?? null,
        breakdown: result.breakdown,
        weaknesses: result.weaknesses ?? [],
        formatting_issues: result.formatting_issues ?? [],
        buzzwords: result.buzzwords ?? [],
        keyword_coverage: result.keyword_coverage ?? {},
        fixes: result.fixes ?? [],
        ats_risks: result.ats_risks ?? [],
      },
      { onConflict: "job_id,resume_version_id" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const spend = await deductTokens(userId, cost, "ats_scan", { jobId }, { meterFree: true });
  return NextResponse.json({ data, balance: spend.balance });
}
