import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { scoreMatch } from "@/lib/job-parser";
import type { ParsedJson } from "@/types/resume";
import type { ParsedJobJson } from "@/types/job";

// POST /api/jobs/[jobId]/match — (re)score this job against the user's primary resume
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const body = await req.json().catch(() => ({}));
  const overrideVersionId = (body.resume_version_id as string | undefined) ?? null;

  // Verify ownership + get parsed job
  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id, user_id, parsed:job_parsed (parsed_json)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsedJob = (job.parsed as { parsed_json: ParsedJobJson }[] | { parsed_json: ParsedJobJson } | null);
  const jobJson = Array.isArray(parsedJob) ? parsedJob[0]?.parsed_json : parsedJob?.parsed_json;
  if (!jobJson) {
    return NextResponse.json({ error: "Job not parsed yet." }, { status: 409 });
  }

  // Use the chosen profile's resume version when provided & owned, else primary.
  let versionId: string | null = null;
  if (overrideVersionId) {
    const { data: owned } = await supabaseAdmin
      .from("resume_parsed_profile")
      .select("version_id, resume_versions!inner(resume_documents!inner(user_id))")
      .eq("version_id", overrideVersionId)
      .maybeSingle();
    const rel = owned?.resume_versions as { resume_documents?: { user_id?: string } | { user_id?: string }[] } | undefined;
    const doc = Array.isArray(rel?.resume_documents) ? rel?.resume_documents[0] : rel?.resume_documents;
    if (owned && doc?.user_id === userId) versionId = owned.version_id as string;
  }

  if (!versionId) {
    const { data: primaryDoc } = await supabaseAdmin
      .from("resume_documents")
      .select("active_version_id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .eq("is_archived", false)
      .maybeSingle();
    versionId = primaryDoc?.active_version_id ?? null;
  }

  if (!versionId) {
    return NextResponse.json(
      { error: "No primary resume set. Upload a resume and mark it primary first." },
      { status: 409 }
    );
  }

  const { data: profile } = await supabaseAdmin
    .from("resume_parsed_profile")
    .select("parsed_json")
    .eq("version_id", versionId)
    .maybeSingle();

  if (!profile?.parsed_json) {
    return NextResponse.json({
      error: "Your resume is still being analyzed. Please wait a moment and try again.",
      reason: "resume_not_ready",
    }, { status: 409 });
  }

  const score = await scoreMatch(profile.parsed_json as ParsedJson, jobJson);

  const { data: match, error } = await supabaseAdmin
    .from("job_matches")
    .upsert(
      {
        job_id: jobId,
        resume_version_id: versionId,
        match_score: Math.round(score.match_score ?? 0),
        matched_keywords: score.matched_keywords ?? [],
        missing_keywords: score.missing_keywords ?? [],
        explanation: score.explanation ?? null,
        scored_json: score,
      },
      { onConflict: "job_id,resume_version_id" }
    )
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: match });
}
