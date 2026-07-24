import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { loadJobContext, isContextError } from "@/lib/job-context";
import { isBlockedJob } from "@/lib/blocklist";
import { generateCoverLetter } from "@/lib/ai-content";
import { sendApplySubmitted, sendManualRequired } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import { parseAshbyUrl, submitToAshby } from "@/lib/ashby-apply";
import { parseGreenhouseUrl, submitToGreenhouse } from "@/lib/greenhouse-apply";
import { resolveAggregatorUrl } from "@/lib/url-resolve";
import { browserAgentConfigured, callBrowserAgent } from "@/lib/browser-client";
import type { ApplyPlatform, ApplyResult, ApplyProfile } from "@/types/apply";

// ─── Platform detection ───────────────────────────────────────────────────────

export function detectPlatform(url: string): ApplyPlatform {
  if (/jobs\.lever\.co|lever\.co\//.test(url)) return "lever";
  if (/boards\.greenhouse\.io|job-boards\.greenhouse\.io|greenhouse\.io\/careers/.test(url)) return "greenhouse";
  if (/ashbyhq\.com|jobs\.ashby\.io/.test(url)) return "ashby";
  if (/myworkdayjobs\.com|workday\.com\/[^/]+\/job/.test(url)) return "workday";
  if (/jobs\.smartrecruiters\.com|smartrecruiters\.com\//.test(url)) return "smartrecruiters";
  if (/bamboohr\.com\/careers|\.bamboohr\.com\/jobs/.test(url)) return "bamboohr";
  if (/\.icims\.com\/jobs|icims\.com\//.test(url)) return "icims";
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

  // Unwrap aggregator redirect links (Adzuna etc.) to the real employer/ATS URL
  // BEFORE detecting platform. This bypasses the aggregator's regional gate
  // ("not available in your region") so we apply on the actual posting and the
  // employer decides eligibility — and it lets a deterministic ATS adapter kick
  // in. Persist the resolved URL so future applies + detectPlatform benefit.
  const rawUrl = jobRow?.source_url ?? "";
  const sourceUrl = await resolveAggregatorUrl(rawUrl);
  if (sourceUrl && sourceUrl !== rawUrl) {
    await supabaseAdmin.from("jobs").update({ source_url: sourceUrl }).eq("id", jobId).then(() => {}, () => {});
  }
  const platform = detectPlatform(sourceUrl);

  // 3b. Block list — never apply to a company/domain the user has blocked.
  const { data: prefs } = await supabaseAdmin
    .from("user_preferences")
    .select("excluded_companies, blocked_domains")
    .eq("user_id", userId)
    .maybeSingle();
  if (isBlockedJob(ctx.jobParsed.company, sourceUrl, prefs?.excluded_companies ?? [], prefs?.blocked_domains ?? [])) {
    return logAttempt(userId, jobId, platform, "blocked", "On your block list — not applied.");
  }

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

  // 5. Download resume once — shared across all platforms that need it
  const resume = await downloadResume(ctx.resumeVersionId);

  // ── Lever ──────────────────────────────────────────────────────────────────
  if (platform === "lever") {
    const parsed = parseLeverUrl(sourceUrl);
    if (!parsed) {
      return logAttempt(userId, jobId, "lever", "manual_required", "Could not parse Lever URL.");
    }
    if (!resume) {
      return logAttempt(userId, jobId, "lever", "failed", "Could not download resume file.");
    }

    const result = await submitToLever(
      parsed.company, parsed.postingId, profile as ApplyProfile,
      resume.blob, resume.filename, coverLetter
    );

    if (result.ok) {
      await upsertApplication(userId, jobId, "applied");
      const attempt = await logAttempt(userId, jobId, "lever", "submitted", undefined, "direct_api");
      sendApplySubmitted(userId, ctx.jobParsed.title ?? "Role", ctx.jobParsed.company ?? "Company", jobId).catch(console.error);
      createNotification(userId, "auto_applied", "Application submitted", `Applied to ${ctx.jobParsed.title ?? "a role"} at ${ctx.jobParsed.company ?? "a company"}`, { job_id: jobId, title: ctx.jobParsed.title, company: ctx.jobParsed.company }).catch(console.error);
      return attempt;
    }
    return logAttempt(userId, jobId, "lever", "failed", result.message);
  }

  // ── Ashby (direct API — no browser needed) ────────────────────────────────
  if (platform === "ashby") {
    const postingId = parseAshbyUrl(sourceUrl);
    if (!postingId) {
      return manualRequired(userId, jobId, "ashby", "Could not extract Ashby posting ID from URL.", ctx, sourceUrl);
    }
    if (!resume) {
      return manualRequired(userId, jobId, "ashby", "Could not download resume.", ctx, sourceUrl);
    }

    const result = await submitToAshby(postingId, profile as ApplyProfile, resume.blob, resume.filename, coverLetter);

    if (result.ok) {
      await upsertApplication(userId, jobId, "applied");
      const attempt = await logAttempt(userId, jobId, "ashby", "submitted", undefined, "direct_api");
      sendApplySubmitted(userId, ctx.jobParsed.title ?? "Role", ctx.jobParsed.company ?? "Company", jobId).catch(console.error);
      createNotification(userId, "auto_applied", "Application submitted", `Applied to ${ctx.jobParsed.title ?? "a role"} at ${ctx.jobParsed.company ?? "a company"}`, { job_id: jobId, title: ctx.jobParsed.title, company: ctx.jobParsed.company }).catch(console.error);
      return attempt;
    }
    // Ashby API failed — fall through to manual
    return manualRequired(userId, jobId, "ashby", result.message, ctx, sourceUrl);
  }

  // ── Greenhouse: try the free direct API first, then fall through ──────────
  // The public Greenhouse Job Board API lets us submit without a browser (~$0).
  // On any failure (auth-gated board, unanswerable required question, reCAPTCHA)
  // we DON'T return — we drop to the browser-agent block below, so there's no
  // regression versus today's behavior, only a cheaper happy path.
  if (platform === "greenhouse" && resume) {
    const gh = parseGreenhouseUrl(sourceUrl);
    if (gh) {
      const result = await submitToGreenhouse(gh.token, gh.jobId, profile as ApplyProfile, resume.blob, resume.filename, coverLetter);
      if (result.ok) {
        await upsertApplication(userId, jobId, "applied");
        const attempt = await logAttempt(userId, jobId, "greenhouse", "submitted", undefined, "direct_api");
        sendApplySubmitted(userId, ctx.jobParsed.title ?? "Role", ctx.jobParsed.company ?? "Company", jobId).catch(console.error);
        createNotification(userId, "auto_applied", "Application submitted", `Applied to ${ctx.jobParsed.title ?? "a role"} at ${ctx.jobParsed.company ?? "a company"}`, { job_id: jobId, title: ctx.jobParsed.title, company: ctx.jobParsed.company }).catch(console.error);
        return attempt;
      }
      console.log(`[apply] greenhouse direct API fell through to browser agent: ${result.message}`);
    }
  }

  // ── Platforms handled by the browser agent (Greenhouse, Workday, etc.) ────
  const browserPlatforms: ApplyPlatform[] = ["greenhouse", "workday", "smartrecruiters", "bamboohr", "icims"];
  if (browserPlatforms.includes(platform) && browserAgentConfigured() && resume) {
    const resumeBase64 = Buffer.from(await resume.blob.arrayBuffer()).toString("base64");
    const agentResult = await callBrowserAgent({
      platform,
      sourceUrl,
      profile: profile as ApplyProfile,
      resumeBase64,
      resumeMime: resume.blob.type,
      resumeFilename: resume.filename,
      coverLetter,
    });

    if (agentResult.status === "submitted") {
      await upsertApplication(userId, jobId, "applied");
      const attempt = await logAttempt(userId, jobId, platform, "submitted", undefined, "browser_agent");
      sendApplySubmitted(userId, ctx.jobParsed.title ?? "Role", ctx.jobParsed.company ?? "Company", jobId).catch(console.error);
      createNotification(userId, "auto_applied", "Application submitted", `Applied to ${ctx.jobParsed.title ?? "a role"} at ${ctx.jobParsed.company ?? "a company"}`, { job_id: jobId, title: ctx.jobParsed.title, company: ctx.jobParsed.company }).catch(console.error);
      return attempt;
    }
    if (agentResult.status === "failed") {
      return logAttempt(userId, jobId, platform, "failed", agentResult.message);
    }
    // manual_required from agent — fall through
  }

  // ── Manual fallback ────────────────────────────────────────────────────────
  return manualRequired(userId, jobId, platform, undefined, ctx, sourceUrl);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLATFORM_LABELS: Partial<Record<ApplyPlatform, string>> = {
  greenhouse: "Greenhouse",
  ashby: "Ashby",
  workday: "Workday",
  smartrecruiters: "SmartRecruiters",
  bamboohr: "BambooHR",
  icims: "iCIMS",
};

async function manualRequired(
  userId: string,
  jobId: string,
  platform: ApplyPlatform,
  reason: string | undefined,
  ctx: { jobParsed: { title?: string | null; company?: string | null } },
  sourceUrl: string
): Promise<ApplyResult> {
  const label = PLATFORM_LABELS[platform] ?? "This platform";
  const msg = reason ?? `${label} requires manual submission. Your cover letter and resume are ready.`;
  await upsertApplication(userId, jobId, "saved");
  const attempt = await logAttempt(userId, jobId, platform, "manual_required", msg, "manual");
  sendManualRequired(userId, ctx.jobParsed.title ?? "Role", ctx.jobParsed.company ?? "Company", jobId, sourceUrl || null).catch(console.error);
  createNotification(userId, "manual_required", "Manual application needed", `${ctx.jobParsed.title ?? "A role"} at ${ctx.jobParsed.company ?? "a company"} requires manual submission. Your cover letter is ready.`, { job_id: jobId, title: ctx.jobParsed.title, company: ctx.jobParsed.company }).catch(console.error);
  return attempt;
}

// engine: which tier handled the apply — "direct_api" (~$0, Lever/Ashby/
// Greenhouse), "browser_agent" (~cents, self-hosted), "manual" (user), or null.
// Powers the per-tier cost breakdown on the admin apply-health view. The column
// is optional (migration 184); the insert degrades gracefully if it's absent.
async function logAttempt(
  userId: string,
  jobId: string,
  platform: ApplyPlatform,
  status: "submitted" | "failed" | "manual_required" | "blocked",
  errorMsg?: string,
  engine?: "direct_api" | "browser_agent" | "manual"
): Promise<ApplyResult> {
  const row: Record<string, unknown> = {
    user_id: userId,
    job_id: jobId,
    platform,
    status,
    submitted_at: status === "submitted" ? new Date().toISOString() : null,
    error_msg: errorMsg ?? null,
  };
  if (engine) row.engine = engine;
  let { data } = await supabaseAdmin
    .from("apply_attempts")
    .insert(row)
    .select("id")
    .single();
  // Pre-migration fallback: retry without the engine column so a deploy before
  // migration 184 never drops apply attempts.
  if (!data && engine) {
    delete row.engine;
    ({ data } = await supabaseAdmin.from("apply_attempts").insert(row).select("id").single());
  }

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
