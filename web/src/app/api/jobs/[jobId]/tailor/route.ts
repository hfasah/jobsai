import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { loadJobContext, isContextError } from "@/lib/job-context";
import { tailorResume } from "@/lib/ai-content";
import { fillExperienceDates } from "@/lib/resume-dates";

// GET /api/jobs/[jobId]/tailor — fetch saved tailored resume
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    result = await tailorResume(ctx.resumeProfile, ctx.jobParsed);
  } catch (err) {
    console.error("Tailoring error:", err);
    return NextResponse.json({ error: "Tailoring failed. Please try again." }, { status: 500 });
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
