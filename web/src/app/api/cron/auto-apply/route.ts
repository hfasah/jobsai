import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { applyToJob } from "@/lib/apply-agent";
import { scoreMatch } from "@/lib/job-parser";
import { tailorResume, generateCoverLetter } from "@/lib/ai-content";
import { loadJobContext, isContextError } from "@/lib/job-context";
import { createNotification } from "@/lib/notifications";
import { sendAutoApplyDigest, sendAutoApplyLowCredits } from "@/lib/email";
import { createSkyvernTask, getSkyvernKey, proxyLocationForLocation } from "@/lib/skyvern";
import { getOrCreateAlias, inboundEmailEnabled } from "@/lib/apply-alias";
import { resolveAggregatorUrl } from "@/lib/url-resolve";
import { deductTokens, addTokens, consumeFreeApply, restoreFreeApply, getTokenBalance, TOKEN_COSTS } from "@/lib/tokens";
import { refundStrandedAutoApplies } from "@/lib/apply-reconcile";
import { resolveAllPendingAgentTasks } from "@/lib/agent-apply-resolve";
import { loadAgentDomainStats, agentPreflight, postingLivenessCheck, isProvenDomain } from "@/lib/agent-preflight";
import type { UserPreferences } from "@/types/preferences";

// MUST be the www host: the apex 308-redirects and webhook senders (Skyvern)
// don't follow redirects — an apex callback URL silently loses every webhook.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://www.jobsai.work").replace(/\/$/, "");

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

  // Eligible = active paid subscription OR a token balance that covers an apply
  // (token packs unlock auto-apply too — each apply just spends TOKEN_COSTS.auto_apply).
  const { data: billingRows } = await supabaseAdmin
    .from("user_billing")
    .select("user_id, plan, subscription_status")
    .in("user_id", enabledPrefs.map((p) => p.user_id))
    .in("plan", ["pro", "premium", "accelerator"])
    .in("subscription_status", ["active", "trialing"]);

  const paidUserIds = new Set((billingRows ?? []).map((b) => b.user_id));

  // Non-subscription users with enough tokens also qualify (each run stops naturally
  // when their balance can't cover the next apply).
  const nonPaid = (enabledPrefs as UserPreferences[]).filter((p) => !paidUserIds.has(p.user_id));
  const tokenUserIds = new Set<string>();
  for (const p of nonPaid) {
    const bal = await getTokenBalance(p.user_id).catch(() => 0);
    if (bal >= TOKEN_COSTS.auto_apply) tokenUserIds.add(p.user_id);
  }

  const activePrefs = (enabledPrefs as UserPreferences[]).filter(
    (p) => paidUserIds.has(p.user_id) || tokenUserIds.has(p.user_id),
  );

  const summary = {
    users_processed: 0,
    jobs_scored: 0,
    jobs_tailored: 0,
    jobs_applied: 0,
    jobs_manual: 0,
    jobs_failed: 0,
    jobs_preflight_skipped: 0,
    errors: 0,
    stopped_early: false,
  };

  // Domain outcome stats for the agent pre-flight (loaded once per run).
  const agentStats = await loadAgentDomainStats();
  // Probe budget: at most this many paid launches per run on domains with NO
  // prior success — bounds the daily worst-case spend on unproven territory
  // while proven domains flow freely. Learning continues, just slowly.
  const MAX_UNPROVEN_PROBES = 2;
  let unprovenProbes = 0;

  // Stop starting new work well before Vercel's 300s hard kill: each job can
  // cost 30s+ (score + tailor + cover letter + Skyvern launch), and a hard
  // timeout dies mid-user with no digest/reconcile and a half-written run.
  // Leftover jobs are still in the 26h window for the next run.
  const startedAt = Date.now();
  const TIME_BUDGET_MS = 240_000;
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS;

  // Users emailed a low-credit reminder this run (dedupe: one email per user).
  const outOfCreditsEmailed = new Set<string>();

  for (const prefs of activePrefs) {
    if (outOfTime()) {
      summary.stopped_early = true;
      console.warn("[cron/auto-apply] time budget reached — remaining users deferred to next run");
      break;
    }
    const userId = prefs.user_id;
    const threshold = prefs.auto_apply_threshold ?? 75;
    const mode = (prefs.auto_apply_mode ?? "hybrid") as "auto" | "hybrid" | "review";
    summary.users_processed++;

    const runLog: AutoApplyJobLog[] = [];

    try {
      // 2. Find jobs imported in the last 26h that haven't been applied to yet.
      // NO embedded joins here: a failing PostgREST embed makes supabase-js
      // report "no rows" with no error surfaced, which silently starved this
      // cron of every job (2026-07-19). Plain queries, joined in code.
      const since = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
      // NOTE: jobs has NO title/company columns — those live on job_parsed.
      // Selecting them here was the actual root error PostgREST rejected
      // ("column jobs.title does not exist") while supabase-js showed no rows.
      const { data: jobs, error: jobsError } = await supabaseAdmin
        .from("jobs")
        .select("id, source_url")
        .eq("user_id", userId)
        .gte("created_at", since)
        .limit(MAX_PER_USER + 5); // fetch a few extra to account for already-applied

      if (jobsError) {
        summary.errors++;
        console.error(`[cron/auto-apply] jobs query failed for user ${userId}:`, jobsError.message);
        continue;
      }
      if (!jobs?.length) continue;

      const jobIds = jobs.map((j) => j.id);
      const [matchesRes, attemptsRes, parsedRes] = await Promise.all([
        supabaseAdmin.from("job_matches").select("job_id, match_score").in("job_id", jobIds),
        supabaseAdmin.from("apply_attempts").select("job_id, status").eq("user_id", userId).in("job_id", jobIds),
        supabaseAdmin.from("job_parsed").select("job_id, title, company").in("job_id", jobIds),
      ]);
      if (matchesRes.error) console.error(`[cron/auto-apply] job_matches query failed for user ${userId}:`, matchesRes.error.message);
      if (attemptsRes.error) console.error(`[cron/auto-apply] apply_attempts query failed for user ${userId}:`, attemptsRes.error.message);
      if (parsedRes.error) console.error(`[cron/auto-apply] job_parsed query failed for user ${userId}:`, parsedRes.error.message);
      const parsedByJob = new Map((parsedRes.data ?? []).map((p) => [p.job_id, p]));
      const matchByJob = new Map((matchesRes.data ?? []).map((m) => [m.job_id, m.match_score]));
      const attemptsByJob = new Map<string, { status: string }[]>();
      for (const a of attemptsRes.data ?? []) {
        const list = attemptsByJob.get(a.job_id) ?? [];
        list.push(a);
        attemptsByJob.set(a.job_id, list);
      }

      // Filter: skip already applied. A job whose attempts are ALL
      // manual_required is a dead end, not an applied job: the import-time
      // path (processJob → autoApplyIfEnabled → applyToJob) logs
      // manual_required for every unknown platform — which is ALL discovered
      // jobs, since aggregator URLs (Adzuna/RemoteOK) never match an ATS.
      // Skipping on attempts.length made the Skyvern escalation below
      // unreachable for exactly the jobs that need it most.
      const unapplied = jobs.filter((j) => {
        const attempts = attemptsByJob.get(j.id) ?? [];
        return attempts.every((a) => a.status === "manual_required");
      }).slice(0, MAX_PER_USER);

      for (const job of unapplied) {
        if (outOfTime()) {
          summary.stopped_early = true;
          console.warn(`[cron/auto-apply] time budget reached mid-user ${userId} — remaining jobs deferred to next run`);
          break;
        }
        const jobId: string = job.id;
        const parsed = parsedByJob.get(jobId);
        const log: AutoApplyJobLog = {
          job_id: jobId,
          title: parsed?.title ?? "Unknown",
          company: parsed?.company ?? "Unknown",
          match_score: null,
          status: "skipped",
          resume_used: null,
          cover_letter_used: false,
        };

        try {
          // 3. Score the job if not already scored
          let matchScore: number | null = null;
          const existingScore = matchByJob.get(jobId);

          if (existingScore != null) {
            matchScore = existingScore;
          } else {
            // Load context and score
            const ctx = await loadJobContext(userId, jobId);
            if (!isContextError(ctx)) {
              const result = await scoreMatch(ctx.resumeProfile, ctx.jobParsed);
              matchScore = Math.round(result.match_score ?? 0);
              summary.jobs_scored++;
              // Save match. Schema (002_jobs.sql): job_matches has NO user_id
              // or match_result columns and resume_version_id is NOT NULL —
              // the old shape 400'd silently, so every score was recomputed on
              // every run (a 10s+ OpenAI call per job per run, forever).
              if (ctx.resumeVersionId) {
                const { error: jmError } = await supabaseAdmin.from("job_matches").upsert(
                  {
                    job_id: jobId,
                    resume_version_id: ctx.resumeVersionId,
                    match_score: matchScore,
                    matched_keywords: result.matched_keywords ?? [],
                    missing_keywords: result.missing_keywords ?? [],
                    explanation: result.explanation ?? null,
                    scored_json: result,
                  },
                  { onConflict: "job_id,resume_version_id" }
                );
                if (jmError) console.error(`[cron/auto-apply] job_matches upsert failed job ${jobId}:`, jmError.message);
              }
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
              // Schema: tailored_resumes has source_resume_version_id (NOT
              // resume_version_id) and no tailored_at — the old column names
              // 400'd silently, so every tailored resume was lost and
              // regenerated on the next run.
              if (ctx.resumeVersionId) {
                const { error: trError } = await supabaseAdmin.from("tailored_resumes").upsert(
                  {
                    user_id: userId,
                    job_id: jobId,
                    source_resume_version_id: ctx.resumeVersionId,
                    tailored_json: tailored.tailored_json,
                  },
                  { onConflict: "job_id,source_resume_version_id" }
                );
                if (trError) console.error(`[cron/auto-apply] tailored_resumes upsert failed job ${jobId}:`, trError.message);
              }
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

              if (!existing.data && ctx.resumeVersionId) {
                const cl = await generateCoverLetter(ctx.resumeProfile, ctx.jobParsed, "professional", "medium");
                // Schema: cover_letters requires resume_version_id (not null)
                // and has no generated_at — the old insert 400'd silently.
                const { error: clError } = await supabaseAdmin.from("cover_letters").insert({
                  user_id: userId,
                  job_id: jobId,
                  resume_version_id: ctx.resumeVersionId,
                  body: cl,
                });
                if (clError) console.error(`[cron/auto-apply] cover_letters insert failed job ${jobId}:`, clError.message);
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

              // posting_url lives on job_parsed, not jobs
              const [{ data: jobRow }, { data: jobParsedRow }] = await Promise.all([
                supabaseAdmin.from("jobs").select("source_url").eq("id", jobId).maybeSingle(),
                supabaseAdmin.from("job_parsed").select("posting_url, location").eq("job_id", jobId).maybeSingle(),
              ]);

              // Unwrap aggregator redirects to the real posting so the agent
              // doesn't hit the aggregator's regional gate (no-op / instant when
              // already a direct URL).
              const cronUrl = await resolveAggregatorUrl(jobRow?.source_url || jobParsedRow?.posting_url || "");

              // Pre-flight BEFORE any charge: refuse to pay Skyvern for runs
              // we already know will fail (login-wall boards, domains with a
              // 100% recent failure record). The job stays manual_required —
              // the user still has the tailored resume + cover letter ready.
              let verdict = agentPreflight(cronUrl, agentStats);
              // Free HTTP probe: dead postings and login-wall redirects never
              // get a paid run.
              if (!verdict.skip && cronUrl) verdict = await postingLivenessCheck(cronUrl);
              // Probe budget for unproven domains.
              if (!verdict.skip && cronUrl && !isProvenDomain(cronUrl, agentStats)) {
                if (unprovenProbes >= MAX_UNPROVEN_PROBES) {
                  verdict = { skip: true, reason: "unproven-domain probe budget reached for this run" };
                } else {
                  unprovenProbes++;
                }
              }
              if (verdict.skip) {
                console.log(`[cron/auto-apply] agent preflight skip job ${jobId}: ${verdict.reason}`);
                summary.jobs_preflight_skipped++;
                log.status = "manual_required";
                summary.jobs_manual++;
                runLog.push(log);
                continue;
              }

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

                // Use a free apply if any remain, else charge credits; skip the
                // job if out of credits (logged as manual so they can apply later).
                const applyCost = TOKEN_COSTS.auto_apply;
                const usedFreeApply = await consumeFreeApply(userId);
                if (!usedFreeApply) {
                  const spend = await deductTokens(userId, applyCost, "auto_apply", { job_id: jobId, source: "cron" }, { meterFree: true });
                  if (!spend.ok) {
                    // Out of credits — auto-apply pauses here. Email a top-up
                    // reminder once per user per run so continuous applying can
                    // resume. outOfCreditsEmailed dedupes within the run; the
                    // notification write throttles across runs.
                    if (!outOfCreditsEmailed.has(userId)) {
                      outOfCreditsEmailed.add(userId);
                      sendAutoApplyLowCredits(userId, summary.jobs_applied).catch((e) => console.error("[cron/auto-apply] low-credit email failed:", e));
                    }
                    log.status = "manual_required";
                    summary.jobs_manual++;
                    runLog.push(log);
                    break; // no point trying more jobs for this user — all will fail
                  }
                }

                const applicantEmail = inboundEmailEnabled()
                  ? await getOrCreateAlias(userId, jobId)
                  : profile.email;
                let task;
                try {
                  task = await createSkyvernTask({
                  url: cronUrl,
                  webhookCallbackUrl: `${APP_URL}/api/webhooks/agent-apply`,
                  navigationPayload: {
                    first_name: profile.first_name,
                    last_name: profile.last_name ?? null,
                    email: applicantEmail,
                    phone: profile.phone ?? null,
                    city: profile.city ?? null,
                    country: profile.country ?? null,
                    linkedin_url: profile.linkedin_url ?? null,
                    authorized_to_work: profile.authorized_to_work ? "Yes" : "No",
                    requires_sponsorship: profile.requires_sponsorship ? "Yes" : "No",
                  },
                  resumeUrl,
                  coverLetter: cl?.body ?? undefined,
                  proxyLocation: proxyLocationForLocation(jobParsedRow?.location),
                  });
                } catch (e) {
                  // Launch failed → give back the free apply or refund credits.
                  if (usedFreeApply) await restoreFreeApply(userId).catch(() => {});
                  else await addTokens(userId, applyCost, "auto_apply_refund", { job_id: jobId, source: "cron" }).catch(() => {});
                  throw e;
                }

                await supabaseAdmin.from("agent_apply_tasks").insert({
                  task_id: task.task_id,
                  user_id: userId,
                  job_id: jobId,
                });

                // Flip the manual_required attempt to a pending agent run
                // ("agent_running" isn't an allowed status; webhook resolves it)
                await supabaseAdmin
                  .from("apply_attempts")
                  .update({ status: "pending", platform: "agent", error_msg: `Skyvern task: ${task.task_id}` })
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

      // 7. Log the run to DB (table created by migration 175 — inserts 404'd
      // silently before it existed)
      const { error: runLogError } = await supabaseAdmin.from("auto_apply_runs").insert({
        user_id: userId,
        jobs_found: unapplied.length,
        jobs_applied: runLog.filter((l) => l.status === "submitted").length,
        jobs_manual: runLog.filter((l) => l.status === "manual_required").length,
        jobs_failed: runLog.filter((l) => l.status === "failed").length,
        threshold_used: threshold,
        job_logs: runLog,
        completed_at: new Date().toISOString(),
      });
      if (runLogError) console.error(`[cron/auto-apply] auto_apply_runs insert failed for user ${userId}:`, runLogError.message);

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

  // Poll-settle every unresolved Skyvern task FIRST (webhooks are best-effort
  // and were lost entirely when the callback URL pointed at the wrong deploy):
  // completed runs flip to submitted, failed runs to failed-with-reason, so
  // the settlement sweep below sees the truth and refunds correctly.
  const agentResolve = await resolveAllPendingAgentTasks().catch((e) => {
    console.error("[cron/auto-apply] agent resolve failed:", e);
    return null;
  });

  // Settlement sweep: refund any auto_apply charge whose job did NOT end in a
  // submitted application (manual_required, failed-without-refund, abandoned).
  // A charge is only earned when the application actually went through.
  const reconcile = await refundStrandedAutoApplies().catch((e) => {
    console.error("[cron/auto-apply] reconcile failed:", e);
    return null;
  });

  console.log("[cron/auto-apply]", summary, agentResolve ?? {}, reconcile ?? {});
  return NextResponse.json({ ok: true, ...summary, agent_resolve: agentResolve, reconcile });
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
