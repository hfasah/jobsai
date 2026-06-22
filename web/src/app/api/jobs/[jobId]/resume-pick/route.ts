import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { pickBestResumeVersion } from "@/lib/job-context";
import type { ParsedJobJson } from "@/types/job";

type Resume = { versionId: string; label: string };

// The user's selectable resumes (the active version of each non-archived doc).
async function listResumes(userId: string): Promise<Resume[]> {
  const { data } = await supabaseAdmin
    .from("resume_documents")
    .select("active_version_id, label, is_primary, created_at")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .not("active_version_id", "is", null)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []).map((d) => ({ versionId: d.active_version_id as string, label: d.label ?? "Resume" }));
}

// GET /api/jobs/[jobId]/resume-pick — which resume this job uses (pinned choice
// or best match), plus the full list so the UI can offer a switcher.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { jobId } = await params;

  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id, resume_version_id, parsed:job_parsed (parsed_json)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const resumes = await listResumes(userId);
  const pinnedId = (job.resume_version_id as string | null) ?? null;

  // Pinned choice wins (if it's still a selectable resume); else best match.
  let current: Resume | null = pinnedId ? resumes.find((r) => r.versionId === pinnedId) ?? null : null;
  if (!current) {
    const rel = job.parsed as { parsed_json: ParsedJobJson }[] | { parsed_json: ParsedJobJson } | null;
    const jobParsed = Array.isArray(rel) ? rel[0]?.parsed_json : rel?.parsed_json;
    const best = jobParsed ? await pickBestResumeVersion(userId, jobParsed) : null;
    current = best ? { versionId: best.versionId, label: best.label } : null;
  }

  return NextResponse.json({ data: current, resumes, pinned: Boolean(pinnedId) });
}

// PATCH /api/jobs/[jobId]/resume-pick { versionId | null } — pin a resume to
// this job (null clears it back to auto-pick).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { jobId } = await params;

  const body = await req.json().catch(() => ({}));
  const versionId = typeof body.versionId === "string" && body.versionId ? body.versionId : null;

  // Validate the chosen version is one the user actually owns/can select.
  if (versionId && !(await listResumes(userId)).some((r) => r.versionId === versionId)) {
    return NextResponse.json({ error: "That resume isn't available." }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("jobs")
    .update({ resume_version_id: versionId })
    .eq("id", jobId)
    .eq("user_id", userId);
  if (error) {
    const hint = /resume_version_id|schema cache/i.test(error.message) ? " (has migration 127 been run?)" : "";
    return NextResponse.json({ error: `${error.message}${hint}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, versionId });
}
