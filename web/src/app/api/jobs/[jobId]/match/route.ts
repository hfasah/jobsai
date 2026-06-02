import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { scoreMatch } from "@/lib/job-parser";
import type { ParsedJson } from "@/types/resume";
import type { ParsedJobJson } from "@/types/job";

// POST /api/jobs/[jobId]/match — (re)score this job against the user's primary resume
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;

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

  // Get primary resume active version
  const { data: primaryDoc } = await supabaseAdmin
    .from("resume_documents")
    .select("active_version_id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .eq("is_archived", false)
    .maybeSingle();

  if (!primaryDoc?.active_version_id) {
    return NextResponse.json(
      { error: "No primary resume set. Upload a resume and mark it primary first." },
      { status: 409 }
    );
  }

  const { data: profile } = await supabaseAdmin
    .from("resume_parsed_profile")
    .select("parsed_json")
    .eq("version_id", primaryDoc.active_version_id)
    .maybeSingle();

  if (!profile?.parsed_json) {
    return NextResponse.json({ error: "Primary resume has no parsed data." }, { status: 409 });
  }

  const score = await scoreMatch(profile.parsed_json as ParsedJson, jobJson);

  const { data: match, error } = await supabaseAdmin
    .from("job_matches")
    .upsert(
      {
        job_id: jobId,
        resume_version_id: primaryDoc.active_version_id,
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
