import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { applyToJob } from "@/lib/apply-agent";
import { scoreMatch } from "@/lib/job-parser";
import { tailorResume, generateCoverLetter } from "@/lib/ai-content";
import { loadJobContext, isContextError } from "@/lib/job-context";
import { createNotification } from "@/lib/notifications";
import { sendAutoApplyDigest } from "@/lib/email";
import { createSkyvernTask, getSkyvernKey } from "@/lib/skyvern";
import type { UserPreferences } from "@/types/preferences";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work").replace(/\/$/, "");

export const maxDuration = 300;

// Max jobs to attempt per user per cron run
const MAX_PER_USER = 8;

// GET /api/cron/auto-apply — daily autonomous apply for users with auto_apply_enabled
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // 1. Find users with auto_apply_enabled, who have active paid subscriptions
  const { data: enabledPrefs } = await supabaseAdmin
    .from("user_preferences")
    .select("*")
    .eq("auto_apply_enabled", true);

  if (!enabledPrefs?.length) {
    return NextResponse.json({ ok: true, users_processed: 0, message: "No users with auto-apply enabled." });
  }

  // Only run for paid users
  const { data: billingRows } = await supabaseAdmin
    .from("user_billing")
    .select("user_id, plan, subscription_status")
    .in("user_id", enabledPrefs.map((p) => p.user_id))
    .in("plan", ["pro", "premium", "accelerator"])
    .in("subscription_status", ["active", "trialing"]);

  const paidUserIds = new Set((billingRows ?? []).map((b) => b.user_id));
  const activePrefs = (enabledPrefs as UserPreferences[]).filter((p) => paidUserIds.has(p.user_id));

  const summary = {
    users_processed: 0,
    jobs_scored: 0,
    jobs_tailored: 0,
    jobs_applied: 0,
    jobs_manual: 0,
    jobs_failed: 0,
    errors: 0,
  };

  for (const prefs of activePrefs) {
    const userId = prefs.user_id;
    const threshold = prefs.auto_apply_threshold ?? 75;
    const mode = (prefs.auto_apply_mode ?? "hybrid") as "auto" | "hybrid" | "review";
    summary.users_processed++;

    const runLog: AutoApplyJobLog[] = [];

    try {
      // 2. Find jobs imported in the last 26h that haven't been applied to yet
      const since = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
      const { data: jobs } = await supabaseAdmin
        .from("jobs")
        .select(`
          id, title, company, source_url,
          job_matches!left(match_score),
          apply_attempts!left(id, status)
        `)
        .eq("user_id", userId)
        .gte("created_at", since)
        .limit(MAX_PER_USER + 5); // fetch a few extra to account for already-applied

      if (!jobs?.length) continue;

      // Filter: skip already applied
      const unapplied = jobs.filter((j) => {
        const attempts = Array.isArray(j.apply_attempts) ? j.apply_attempts : [];
        return attempts.length === 0;
      }).slice(0, MAX_PER_USER);

      for (const job of unapplied) {
        const jobId: string = job.id;
        const log: AutoApplyJobLog = {
          job_id: jobId,
          title: job.title ?? "Unknown",
          company: job.company ?? "Unknown",
          match_score: null,
          status: "skipped",
          resume_used: null,
          cover_letter_used: false,
        };

        try {
          // 3. Score the job if not already scored
          let matchScore: number | null = null;
          const existingMatch = Array.isArray(job.job_matches) ? job.job_matches[0] : null;

          if (existingMatch?.match_score != null) {
            matchScore = existingMatch.match_score;
          } else {
            // Load context and score
            const ctx = await loadJobContext(userId, jobId);
            if (!isContextError(ctx)) {
              const result = await scoreMatch(ctx.resumeProfile, ctx.jobParsed);
              matchScore = Math.round(result.match_score ?? 0);
              summary.jobs_scored++;
              // Save match
              await supabaseAdmin.from("job_matches").upsert({
                user_id: userId,
                job_id: jobId,
                match_score: matchScore,
                match_result: result,
              });
            }
          }

          log.match_score = matchScore;

          // 4. Mode-based routing
          const aboveThreshold = matchScore !== null && matchScore >= threshold;

          // Review mode: always queue for approval, never auto-apply
          if (mode === "review") {
            await supabaseAdmin.from("applications").upsert(
              { user_id: userId, job_id: jobId, stage: "saved", stage_history: [{ stage: "saved", at: new Date().toISOString() }] },
              { onConflict: "user_id,job_id" }
            );
            log.status = "skipped";
            log.match_score = matchScore;
            runLog.push(log);
            continue;
          }

          // Hybrid mode: only auto-apply if above threshold, else queue for review
          if (mode === "hybrid" && !aboveThreshold) {
            await supabaseAdmin.from("applications").upsert(
              { user_id: userId, job_id: jobId, stage: "saved", stage_history: [{ stage: "saved", at: new Date().toISOString() }] },
              { onConflict: "user_id,job_id" }
            );
            log.status = "below_threshold";
            runLog.push(log);
            continue;
          }

          // Auto mode or hybrid above threshold: skip if below threshold entirely
          if (!aboveThreshold) {
            log.status = "below_threshold";
            runLog.push(log);
            continue;
          }

          // 5. Tailor resume + cover letter then apply
          const ctx = await loadJobContext(userId, jobId);
          if (!isContextError(ctx)) {
            // Tailor resume
            try {
              const tailored = await tailorResume(ctx.resumeProfile, ctx.jobParsed);
              await supabaseAdmin.from("tailored_resumes").upsert({
                user_id: userId,
                job_id: jobId,
                resume_version_id: ctx.resumeVersionId,
                tailored_json: tailored.tailored_json,
                tailored_at: new Date().toISOString(),
              });
              log.resume_used = ctx.resumeVersionId ?? null;
              summary.jobs_tailored++;
            } catch {
              // Continue even if tailoring fails — apply with base resume
            }

            // Cover letter
            try {
              const existing = await supabaseAdmin
                .from("cover_letters")
                .select("id")
                .eq("job_id", jobId)
                .eq("user_id", userId)
                .maybeSingle();

              if (!existing.data) {
                const cl = await generateCoverLetter(ctx.resumeProfile, ctx.jobParsed, "professional", "medium");
                await supabaseAdmin.from("cover_letters").insert({
                  user_id: userId,
                  job_id: jobId,
                  body: cl,
                  generated_at: new Date().toISOString(),
                });
              }
              log.cover_letter_used = true;
            } catch {
              // Non-fatal
            }
          }

          // 6. Try direct ATS apply first; escalate to browser agent for LinkedIn/Indeed/etc.
          const result = await applyToJob(userId, jobId);

          if (result.status === "submitted") {
            log.status = "submitted";
            summary.jobs_applied++;
          } else if (result.status === "blocked") {
            log.status = "blocked";
          } else if (result.status === "manual_required" && getSkyvernKey()) {
            // Direct ATS submit not possible — launch Skyvern browser agent instead
            try {
              // Load apply profile for Skyvern payload
              const { data: profile } = await supabaseAdmin
                .from("apply_profiles")
                .select("*")
                .eq("user_id", userId)
                .maybeSingle();

              const { data: jobRow } = await supabaseAdmin
                .from("jobs")
                .select("source_url, posting_url")
                .eq("id", jobId)
                .maybeSingle();

              const cronUrl = jobRow?.source_url || jobRow?.posting_url;
              if (profile?.email && profile?.first_name && cronUrl) {
                // Generate 1-hour resume download URL
                const { data: doc } = await supabaseAdmin
                  .from("resume_documents")
                  .select("active_version_id, resume_versions!resume_documents_active_version_id_fkey(storage_key)")
                  .eq("user_id", userId)
                  .eq("is_primary", true)
                  .maybeSingle();

                let resumeUrl: string | undefined;
                const storageKey = (doc?.resume_versions as { storage_key?: string } | null)?.storage_key;
                if (storageKey) {
                  const { data: signed } = await supabaseAdmin.storage
                    .from(STORAGE_BUCKET)
                    .createSignedUrl(storageKey, 3600);
                  if (signed?.signedUrl) resumeUrl = signed.signedUrl;
                }

                const { data: cl } = await supabaseAdmin
                  .from("cover_letters")
                  .select("body")
                  .eq("job_id", jobId)
                  .eq("user_id", userId)
                  .order("updated_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();

                const task = await createSkyvernTask({
                  url: cronUrl,
                  webhookCallbackUrl: `${APP_URL}/api/webhooks/agent-apply`,
                  navigationPayload: {
                    first_name: profile.first_name,
                    last_name: profile.last_name ?? null,
                    email: profile.email,
                    phone: profile.phone ?? null,
                    city: profile.city ?? null,
                    country: profile.country ?? null,
                    linkedin_url: profile.linkedin_url ?? null,
                    authorized_to_work: profile.authorized_to_work ? "Yes" : "No",
                    requires_sponsorship: profile.requires_sponsorship ? "Yes" : "No",
                  },
                  resumeUrl,
                  coverLetter: cl?.body ?? undefined,
                });

                await supabaseAdmin.from("agent_apply_tasks").insert({
                  task_id: task.task_id,
                  user_id: userId,
                  job_id: jobId,
                });

                // Update the manual_required attempt to agent_running
                await supabaseAdmin
                  .from("apply_attempts")
                  .update({ status: "agent_running", error_msg: `Skyvern task: ${task.task_id}` })
                  .eq("user_id", userId)
                  .eq("job_id", jobId)
                  .eq("status", "manual_required");

                log.status = "submitted"; // Count as in-flight — webhook will confirm
                summary.jobs_applied++;
              } else {
                log.status = "manual_required";
                summary.jobs_manual++;
              }
            } catch (skyvernErr) {
              console.error(`[cron/auto-apply] Skyvern fallback failed job ${jobId}:`, skyvernErr);
              log.status = "manual_required";
              summary.jobs_manual++;
            }
          } else {
            // manual_required without Skyvern, or failed
            const applyStatus = result.status;
            if (applyStatus === "manual_required" || applyStatus === "failed") {
              log.status = applyStatus;
            }
            if (result.status === "manual_required") summary.jobs_manual++;
            else summary.jobs_failed++;
          }
        } catch (err) {
          log.status = "failed";
          summary.errors++;
          console.error(`[cron/auto-apply] job ${jobId} user ${userId}:`, err);
        }

        runLog.push(log);
      }

      // 7. Log the run to DB
      await supabaseAdmin.from("auto_apply_runs").insert({
        user_id: userId,
        jobs_found: unapplied.length,
        jobs_applied: runLog.filter((l) => l.status === "submitted").length,
        jobs_manual: runLog.filter((l) => l.status === "manual_required").length,
        jobs_failed: runLog.filter((l) => l.status === "failed").length,
        threshold_used: threshold,
        job_logs: runLog,
        completed_at: new Date().toISOString(),
      });

      // 8. Send daily email digest
      const applied = runLog.filter((l) => l.status === "submitted");
      const manual = runLog.filter((l) => l.status === "manual_required");
      if (runLog.length > 0) {
        sendAutoApplyDigest(userId, { applied, manual, threshold }).catch(console.error);
        if (applied.length > 0) {
          createNotification(
            userId,
            "auto_applied",
            `${applied.length} application${applied.length > 1 ? "s" : ""} submitted overnight`,
            `JobsAI automatically applied to ${applied.length} job${applied.length > 1 ? "s" : ""} on your behalf. Check your activity log.`,
            { count: applied.length }
          ).catch(console.error);
        }
      }
    } catch (err) {
      summary.errors++;
      console.error(`[cron/auto-apply] user ${userId}:`, err);
    }
  }

  console.log("[cron/auto-apply]", summary);
  return NextResponse.json({ ok: true, ...summary });
}

interface AutoApplyJobLog {
  job_id: string;
  title: string;
  company: string;
  match_score: number | null;
  status: "submitted" | "manual_required" | "failed" | "blocked" | "skipped" | "below_threshold";
  resume_used: string | null;
  cover_letter_used: boolean;
}
