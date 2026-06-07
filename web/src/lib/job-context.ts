import { supabaseAdmin } from "@/lib/supabase";
import type { ParsedJson } from "@/types/resume";
import type { ParsedJobJson } from "@/types/job";

export interface JobContext {
  resumeProfile: ParsedJson;
  resumeVersionId: string;
  resumeRawText: string | null;
  jobParsed: ParsedJobJson;
}

export type JobContextError =
  | { error: string; status: 404 | 409 };

// ─── Best-resume selection ────────────────────────────────────────────────────
// Users keep a few role-targeted resumes (e.g. "DevOps Engineer", "SRE"). For a
// given job we pick the closest-matching one automatically, so auto-apply and the
// per-job tools adapt the right base resume.

function jobTerms(job: ParsedJobJson): string[] {
  const titleWords = (job.title ?? "").toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 2);
  const skills = (job.skills ?? []).map((s) => s.toLowerCase());
  return [...new Set([...titleWords, ...skills])];
}

function resumeHaystack(p: ParsedJson, label: string): string {
  const exp = (p.experience ?? []).map((e) => `${e.title} ${e.company}`).join(" ");
  const skills = (p.skills ?? []).map((s) => s.skill).join(" ");
  return `${label} ${p.headline ?? ""} ${p.summary ?? ""} ${exp} ${skills}`.toLowerCase();
}

export interface BestResume { versionId: string; profile: ParsedJson; label: string }

/** Scores the user's resumes against a job and returns the best match (or null). */
export async function pickBestResumeVersion(
  userId: string,
  job: ParsedJobJson
): Promise<BestResume | null> {
  const { data: docs } = await supabaseAdmin
    .from("resume_documents")
    .select("active_version_id, is_primary, label")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .not("active_version_id", "is", null);
  if (!docs?.length) return null;

  const meta = new Map(docs.map((d) => [d.active_version_id as string, d]));
  const { data: profiles } = await supabaseAdmin
    .from("resume_parsed_profile")
    .select("version_id, parsed_json")
    .in("version_id", [...meta.keys()]);
  if (!profiles?.length) return null;

  const terms = jobTerms(job);
  let best = profiles[0];
  let bestScore = -1;
  for (const p of profiles) {
    const m = meta.get(p.version_id);
    const hay = resumeHaystack(p.parsed_json as ParsedJson, m?.label ?? "");
    let score = terms.reduce((n, t) => (hay.includes(t) ? n + 1 : n), 0);
    if (m?.is_primary) score += 0.5; // tiebreak toward the user's primary
    if (score > bestScore) { bestScore = score; best = p; }
  }

  // No signal at all → prefer the primary resume.
  if (bestScore <= 0) {
    const primary = profiles.find((p) => meta.get(p.version_id)?.is_primary);
    if (primary) best = primary;
  }

  return {
    versionId: best.version_id,
    profile: best.parsed_json as ParsedJson,
    label: meta.get(best.version_id)?.label ?? "Resume",
  };
}

/**
 * Loads a job's parsed data + the user's best-matching resume profile.
 * Returns either the context or an error with an HTTP status.
 */
// Resolve a specific resume version the user owns (used to honor a chosen
// "profile"). Returns null if the version isn't found or isn't theirs.
async function loadOwnedVersion(
  userId: string,
  versionId: string
): Promise<{ profile: ParsedJson; versionId: string } | null> {
  const { data: prof } = await supabaseAdmin
    .from("resume_parsed_profile")
    .select("version_id, parsed_json, resume_versions!inner(document_id, resume_documents!inner(user_id))")
    .eq("version_id", versionId)
    .maybeSingle();

  const rel = prof?.resume_versions as { resume_documents?: { user_id?: string } | { user_id?: string }[] } | undefined;
  const doc = Array.isArray(rel?.resume_documents) ? rel?.resume_documents[0] : rel?.resume_documents;
  if (!prof || doc?.user_id !== userId) return null;

  return { profile: prof.parsed_json as ParsedJson, versionId: prof.version_id as string };
}

export async function loadJobContext(
  userId: string,
  jobId: string,
  overrideVersionId?: string | null
): Promise<JobContext | JobContextError> {
  // Job ownership + parsed
  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id, user_id, parsed:job_parsed (parsed_json)")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (!job) return { error: "Job not found.", status: 404 };

  const parsedRel = job.parsed as { parsed_json: ParsedJobJson }[] | { parsed_json: ParsedJobJson } | null;
  const jobParsed = Array.isArray(parsedRel) ? parsedRel[0]?.parsed_json : parsedRel?.parsed_json;
  if (!jobParsed) return { error: "Job has not been parsed yet.", status: 409 };

  // Honor an explicitly chosen profile resume when provided & owned; otherwise
  // pick the resume that best matches this job (falls back to primary).
  const chosen = overrideVersionId ? await loadOwnedVersion(userId, overrideVersionId) : null;
  const best = chosen ?? (await pickBestResumeVersion(userId, jobParsed));
  if (!best) {
    return { error: "No resume found. Upload a resume first.", status: 409 };
  }

  const { data: textRow } = await supabaseAdmin
    .from("resume_texts")
    .select("plain_text")
    .eq("version_id", best.versionId)
    .maybeSingle();

  return {
    resumeProfile: best.profile,
    resumeVersionId: best.versionId,
    resumeRawText: textRow?.plain_text ?? null,
    jobParsed,
  };
}

export interface ResumeContext {
  resumeProfile: ParsedJson;
  resumeVersionId: string;
  resumeRawText: string | null;
}

/** Loads the user's primary resume active-version profile (no job needed). */
export async function loadResumeProfile(
  userId: string
): Promise<ResumeContext | JobContextError> {
  const { data: primaryDoc } = await supabaseAdmin
    .from("resume_documents")
    .select("active_version_id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .eq("is_archived", false)
    .maybeSingle();

  if (!primaryDoc?.active_version_id) {
    return { error: "No primary resume set. Upload a resume and mark it primary first.", status: 409 };
  }
  const resumeVersionId = primaryDoc.active_version_id;

  const { data: profile } = await supabaseAdmin
    .from("resume_parsed_profile")
    .select("parsed_json")
    .eq("version_id", resumeVersionId)
    .maybeSingle();

  if (!profile?.parsed_json) {
    return { error: "Primary resume has no parsed data.", status: 409 };
  }

  const { data: textRow } = await supabaseAdmin
    .from("resume_texts")
    .select("plain_text")
    .eq("version_id", resumeVersionId)
    .maybeSingle();

  return {
    resumeProfile: profile.parsed_json as ParsedJson,
    resumeVersionId,
    resumeRawText: textRow?.plain_text ?? null,
  };
}

export function isContextError(c: JobContext | ResumeContext | JobContextError): c is JobContextError {
  return "error" in c;
}
