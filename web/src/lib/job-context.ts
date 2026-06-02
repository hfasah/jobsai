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

/**
 * Loads a job's parsed data + the user's primary resume active version profile.
 * Returns either the context or an error with an HTTP status.
 */
export async function loadJobContext(
  userId: string,
  jobId: string
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

  // Primary resume → active version
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
    jobParsed,
  };
}

export function isContextError(c: JobContext | JobContextError): c is JobContextError {
  return "error" in c;
}
