import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { loadJobContext, isContextError } from "@/lib/job-context";
import { generateCoverLetter } from "@/lib/ai-content";
import type { ApplyPlatform, ApplyResult, ApplyProfile } from "@/types/apply";

// ─── Platform detection ───────────────────────────────────────────────────────

export function detectPlatform(url: string): ApplyPlatform {
  if (/jobs\.lever\.co|lever\.co\//.test(url)) return "lever";
  if (/boards\.greenhouse\.io|job-boards\.greenhouse\.io|greenhouse\.io\/careers/.test(url)) return "greenhouse";
  if (/ashbyhq\.com|jobs\.ashby\.io/.test(url)) return "ashby";
  return "unknown";
}

function parseLeverUrl(url: string): { company: string; postingId: string } | null {
  // https://jobs.lever.co/{company}/{uuid}[/apply]
  const m = url.match(/lever\.co\/([^/]+)\/([a-f0-9-]{36})/i);
  if (!m) return null;
  return { company: m[1], postingId: m[2] };
}

// ─── Lever direct API submission ─────────────────────────────────────────────

async function submitToLever(
  company: string,
  postingId: string,
  profile: ApplyProfile,
  resumeBlob: Blob,
  resumeFilename: string,
  coverLetter: string
): Promise<{ ok: boolean; message?: string }> {
  const endpoint = `https://api.lever.co/v0/postings/${company}/${postingId}/apply`;

  const form = new FormData();
  form.append("name", [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim());
  form.append("email", profile.email ?? "");
  if (profile.phone)         form.append("phone", profile.phone);
  if (profile.linkedin_url)  form.append("urls[linkedin]", profile.linkedin_url);
  if (profile.github_url)    form.append("urls[github]", profile.github_url);
  if (profile.portfolio_url) form.append("urls[portfolio]", profile.portfolio_url);
  if (profile.website_url)   form.append("urls[other]", profile.website_url);
  form.append("comments", coverLetter);
  form.append("resume", new File([resumeBlob], resumeFilename, { type: resumeBlob.type }));

  const res = await fetch(endpoint, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  });

  if (res.ok) return { ok: true };
  const text = await res.text().catch(() => "");
  return {
    ok: false,
    message: `Lever responded ${res.status}: ${text.slice(0, 300)}`,
  };
}

// ─── Resume download from Supabase Storage ────────────────────────────────────

async function downloadResume(
  versionId: string
): Promise<{ blob: Blob; filename: string } | null> {
  const { data: ver } = await supabaseAdmin
    .from("resume_versions")
    .select("storage_key, file_name, file_mime")
    .eq("id", versionId)
    .single();

  if (!ver) return null;

  const { data: fileData, error } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .download(ver.storage_key);

  if (error || !fileData) return null;
  return { blob: new Blob([await fileData.arrayBuffer()], { type: ver.file_mime }), filename: ver.file_name };
}

// ─── Main apply entry point ───────────────────────────────────────────────────

export async function applyToJob(userId: string, jobId: string): Promise<ApplyResult> {
  // 1. Load apply profile
  const { data: profile } = await supabaseAdmin
    .from("apply_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile?.email || !profile?.first_name) {
    return logAttempt(userId, jobId, "unknown", "manual_required",
      "Apply profile incomplete. Fill in your apply profile first.");
  }

  // 2. Load job context (resume + parsed job)
  const ctx = await loadJobContext(userId, jobId);
  if (isContextError(ctx)) {
    return logAttempt(userId, jobId, "unknown", "failed", ctx.error);
  }

  // 3. Get the job's source URL to detect platform
  const { data: jobRow } = await supabaseAdmin
    .from("jobs")
    .select("source_url")
    .eq("id", jobId)
    .single();

  const sourceUrl = jobRow?.source_url ?? "";
  const platform = detectPlatform(sourceUrl);

  // 4. Generate cover letter (always — needed for Lever comments and manual apply)
  let coverLetter = "";
  try {
    // Check if one already exists for this job
    const { data: existing } = await supabaseAdmin
      .from("cover_letters")
      .select("body")
      .eq("job_id", jobId)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing?.body) {
      coverLetter = existing.body;
    } else {
      coverLetter = await generateCoverLetter(ctx.resumeProfile, ctx.jobParsed, "professional", "medium");
      // Persist for later viewing
      await supabaseAdmin.from("cover_letters").insert({
        user_id: userId,
        job_id: jobId,
        resume_version_id: ctx.resumeVersionId,
        tone: "professional",
        length: "medium",
        body: coverLetter,
      }).select().single();
    }
  } catch {
    // Non-fatal — continue without cover letter
  }

  // 5. Platform-specific submission
  if (platform === "lever") {
    const parsed = parseLeverUrl(sourceUrl);
    if (!parsed) {
      return logAttempt(userId, jobId, "lever", "manual_required", "Could not parse Lever URL.");
    }

    const resume = await downloadResume(ctx.resumeVersionId);
    if (!resume) {
      return logAttempt(userId, jobId, "lever", "failed", "Could not download resume file.");
    }

    const result = await submitToLever(
      parsed.company,
      parsed.postingId,
      profile as ApplyProfile,
      resume.blob,
      resume.filename,
      coverLetter
    );

    if (result.ok) {
      // Move application to "applied" stage
      await upsertApplication(userId, jobId, "applied");
      return logAttempt(userId, jobId, "lever", "submitted");
    }
    return logAttempt(userId, jobId, "lever", "failed", result.message);
  }

  // 6. All other platforms → manual_required (cover letter + resume are ready)
  await upsertApplication(userId, jobId, "saved");
  return logAttempt(userId, jobId, platform, "manual_required",
    `${platform === "greenhouse" ? "Greenhouse" : platform === "ashby" ? "Ashby" : "This platform"} requires manual submission. Your cover letter and resume are ready.`
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function logAttempt(
  userId: string,
  jobId: string,
  platform: ApplyPlatform,
  status: "submitted" | "failed" | "manual_required",
  errorMsg?: string
): Promise<ApplyResult> {
  const { data } = await supabaseAdmin
    .from("apply_attempts")
    .insert({
      user_id: userId,
      job_id: jobId,
      platform,
      status,
      submitted_at: status === "submitted" ? new Date().toISOString() : null,
      error_msg: errorMsg ?? null,
    })
    .select("id")
    .single();

  return {
    status,
    platform,
    attempt_id: data?.id ?? "",
    message: errorMsg,
  };
}

async function upsertApplication(userId: string, jobId: string, stage: string) {
  const now = new Date().toISOString();
  await supabaseAdmin
    .from("applications")
    .upsert(
      {
        user_id: userId,
        job_id: jobId,
        stage,
        applied_at: stage === "applied" ? now : null,
        stage_history: [{ stage, at: now }],
      },
      { onConflict: "user_id,job_id", ignoreDuplicates: false }
    );
}
