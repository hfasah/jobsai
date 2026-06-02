import { createHash } from "crypto";

import { supabaseAdmin } from "@/lib/supabase";
import { parseJobText, scoreMatch } from "@/lib/job-parser";
import { applyToJob } from "@/lib/apply-agent";
import { sendHighMatch } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import type { ParsedJson } from "@/types/resume";

const MIN_CHARS = 300;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

// ─── URL scraping via Jina.ai Reader ─────────────────────────────────────────

export async function fetchUrlContent(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-No-Cache": "true",
    "X-Return-Format": "text",
  };
  if (process.env.JINA_API_KEY) {
    headers["Authorization"] = `Bearer ${process.env.JINA_API_KEY}`;
  }

  const res = await fetch(jinaUrl, {
    headers,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`Jina fetch failed: ${res.status}`);

  const json = (await res.json()) as { data?: { content?: string } };
  const content = json.data?.content?.trim();
  if (!content) throw new Error("No content extracted from URL");
  return content;
}

// ─── Core job processing pipeline ────────────────────────────────────────────

export async function processJob(jobId: string, userId: string, rawText: string, notifyOnMatch = false) {
  try {
    const parsed = await parseJobText(rawText);

    await supabaseAdmin.from("job_parsed").upsert({
      job_id: jobId,
      title: parsed.title ?? null,
      company: parsed.company ?? null,
      location: parsed.location ?? null,
      employment_type: parsed.employment_type ?? null,
      seniority: parsed.seniority ?? null,
      compensation: parsed.compensation ?? null,
      posting_url: parsed.posting_url ?? null,
      summary: parsed.summary ?? null,
      skills: parsed.skills ?? [],
      responsibilities: parsed.responsibilities ?? [],
      requirements: parsed.requirements ?? [],
      parsed_json: parsed,
    });

    await supabaseAdmin
      .from("jobs")
      .update({ detected_language: parsed.detected_language ?? null })
      .eq("id", jobId);

    const { data: primaryDoc } = await supabaseAdmin
      .from("resume_documents")
      .select("active_version_id")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .eq("is_archived", false)
      .maybeSingle();

    const activeVersionId = primaryDoc?.active_version_id;

    let matchScore = 0;
    if (activeVersionId) {
      const { data: profile } = await supabaseAdmin
        .from("resume_parsed_profile")
        .select("parsed_json")
        .eq("version_id", activeVersionId)
        .maybeSingle();

      if (profile?.parsed_json) {
        const score = await scoreMatch(profile.parsed_json as ParsedJson, parsed);
        matchScore = Math.round(score.match_score ?? 0);
        await supabaseAdmin.from("job_matches").upsert(
          {
            job_id: jobId,
            resume_version_id: activeVersionId,
            match_score: matchScore,
            matched_keywords: score.matched_keywords ?? [],
            missing_keywords: score.missing_keywords ?? [],
            explanation: score.explanation ?? null,
            scored_json: score,
          },
          { onConflict: "job_id,resume_version_id" }
        );
      }
    }

    await supabaseAdmin.from("jobs").update({ status: "ready" }).eq("id", jobId);

    autoApplyIfEnabled(jobId, userId, matchScore).catch(console.error);

    if (notifyOnMatch && matchScore > 0) {
      maybeNotifyHighMatch(userId, jobId, matchScore, parsed.title ?? "Role", parsed.company ?? "Company").catch(console.error);
    }
  } catch (err) {
    console.error("Job processing error:", err);
    await supabaseAdmin
      .from("jobs")
      .update({
        status: "failed",
        parse_error_msg: err instanceof Error ? err.message : "Unknown error",
      })
      .eq("id", jobId);
  }
}

export async function autoApplyIfEnabled(jobId: string, userId: string, matchScore: number) {
  const { data: prefs } = await supabaseAdmin
    .from("user_preferences")
    .select("auto_apply_enabled, auto_apply_threshold")
    .eq("user_id", userId)
    .maybeSingle();

  if (!prefs?.auto_apply_enabled) return;
  if (matchScore < (prefs.auto_apply_threshold ?? 75)) return;

  await applyToJob(userId, jobId);
}

async function maybeNotifyHighMatch(
  userId: string,
  jobId: string,
  matchScore: number,
  title: string,
  company: string
) {
  const { data: prefs } = await supabaseAdmin
    .from("user_preferences")
    .select("auto_apply_threshold, auto_apply_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  const threshold = prefs?.auto_apply_threshold ?? 75;
  if (matchScore < threshold) return;
  // auto-apply is on: apply-agent will send the "submitted" or "manual_required" email instead
  if (prefs?.auto_apply_enabled) return;

  await sendHighMatch(userId, title, company, matchScore, jobId);
  createNotification(userId, "high_match", "High match found", `${title} at ${company} — ${matchScore}% match`, { job_id: jobId, title, company, score: matchScore }).catch(console.error);
}

// ─── Import a single job from URL ─────────────────────────────────────────────

export interface ImportResult {
  job_id: string;
  status: "created" | "dedup";
}

export async function importJobFromUrl(
  url: string,
  userId: string,
  force = false,
  notifyOnMatch = false
): Promise<ImportResult> {
  const rawText = await fetchUrlContent(url);

  if (rawText.trim().length < MIN_CHARS) {
    throw new Error(`Job description too short (min ${MIN_CHARS} characters)`);
  }

  const canonical = rawText.replace(/\s+/g, " ").trim().toLowerCase();
  const contentHash = createHash("sha256").update(canonical).digest("hex");
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS).toISOString();

  if (!force) {
    const { data: byUrl } = await supabaseAdmin
      .from("jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("source_url", url)
      .gte("created_at", sevenDaysAgo)
      .maybeSingle();
    if (byUrl) return { job_id: byUrl.id, status: "dedup" };

    const { data: byHash } = await supabaseAdmin
      .from("jobs")
      .select("id")
      .eq("user_id", userId)
      .eq("content_hash", contentHash)
      .gte("created_at", sevenDaysAgo)
      .maybeSingle();
    if (byHash) return { job_id: byHash.id, status: "dedup" };
  }

  const { data: job, error } = await supabaseAdmin
    .from("jobs")
    .insert({
      user_id: userId,
      source_type: "text",
      status: "processing",
      content_hash: contentHash,
      raw_text: rawText,
      source_url: url,
    })
    .select("id")
    .single();

  if (error || !job) throw new Error("Failed to create job record");

  processJob(job.id, userId, rawText, notifyOnMatch).catch(console.error);

  return { job_id: job.id, status: "created" };
}
