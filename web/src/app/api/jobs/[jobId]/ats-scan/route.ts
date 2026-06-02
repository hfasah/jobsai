import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { loadJobContext, isContextError } from "@/lib/job-context";
import { scanATS } from "@/lib/ai-content";

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
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { jobId } = await params;

  const ctx = await loadJobContext(userId, jobId);
  if (isContextError(ctx)) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status });
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
  return NextResponse.json({ data });
}
