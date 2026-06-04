import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { pickBestResumeVersion } from "@/lib/job-context";
import type { ParsedJobJson } from "@/types/job";

// GET /api/jobs/[jobId]/resume-pick — which resume auto-apply would use for this job.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { jobId } = await params;

  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id, parsed:job_parsed (parsed_json)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const rel = job.parsed as { parsed_json: ParsedJobJson }[] | { parsed_json: ParsedJobJson } | null;
  const jobParsed = Array.isArray(rel) ? rel[0]?.parsed_json : rel?.parsed_json;
  if (!jobParsed) return NextResponse.json({ data: null });

  const best = await pickBestResumeVersion(userId, jobParsed);
  return NextResponse.json({ data: best ? { label: best.label, versionId: best.versionId } : null });
}
