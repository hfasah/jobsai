import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { loadJobContext, isContextError } from "@/lib/job-context";
import { generateInterviewPrep } from "@/lib/ai-content";

// GET /api/jobs/[jobId]/interview-prep — fetch the saved prep for this job
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { jobId } = await params;

  const { data } = await supabaseAdmin
    .from("interview_preps")
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ data: data ?? null });
}

// POST /api/jobs/[jobId]/interview-prep — generate (or regenerate) prep
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
    result = await generateInterviewPrep(ctx.resumeProfile, ctx.jobParsed);
  } catch (err) {
    console.error("Interview prep error:", err);
    return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
  }

  const { data, error } = await supabaseAdmin
    .from("interview_preps")
    .upsert(
      {
        user_id: userId,
        job_id: jobId,
        resume_version_id: ctx.resumeVersionId,
        questions: result.questions,
      },
      { onConflict: "job_id,resume_version_id" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
