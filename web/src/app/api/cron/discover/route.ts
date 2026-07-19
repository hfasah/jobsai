import { NextRequest, NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase";
import { discoverJobs } from "@/lib/job-discovery";
import { importDiscoveredJob } from "@/lib/job-import";
import { sendDiscoverySummary } from "@/lib/email";
import { createNotification } from "@/lib/notifications";
import type { UserPreferences } from "@/types/preferences";

// Allow up to 5 minutes on Vercel Pro
export const maxDuration = 300;

// Max jobs to import per user per run — keeps the run bounded
const MAX_IMPORTS_PER_USER = 10;

// GET /api/cron/discover — called by Vercel Cron on schedule
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET not configured");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Load all users who have at least job titles or keywords set
  const { data: allPrefs, error } = await supabaseAdmin
    .from("user_preferences")
    .select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const activeUsers = (allPrefs ?? []).filter(
    (p) =>
      (Array.isArray(p.job_titles) && p.job_titles.length > 0) ||
      (Array.isArray(p.keywords) && p.keywords.length > 0)
  ) as UserPreferences[];

  const summary = {
    users_processed: 0,
    jobs_discovered: 0,
    jobs_imported: 0,
    jobs_deduped: 0,
    errors: 0,
  };

  for (const prefs of activeUsers) {
    summary.users_processed++;
    try {
      const { jobs } = await discoverJobs(prefs);
      summary.jobs_discovered += jobs.length;

      // Take only the top N by relevance (already sorted by discoverJobs)
      const toImport = jobs.slice(0, MAX_IMPORTS_PER_USER);
      const importedJobs: { title: string; company: string; jobId: string }[] = [];

      for (const job of toImport) {
        if (!job.url) continue;
        try {
          // Import straight from provider data — aggregator URLs (Adzuna
          // /land/ad/…) are bot-blocked, so scraping them 403s every time.
          const result = await importDiscoveredJob(job, prefs.user_id, true);
          if (result.status === "created") {
            summary.jobs_imported++;
            importedJobs.push({ title: job.title, company: job.company, jobId: result.job_id });
          } else {
            summary.jobs_deduped++;
          }
        } catch (err) {
          summary.errors++;
          console.error(`[cron] Import failed for ${job.url} (user ${prefs.user_id}):`, err);
        }
      }

      // Record when this user was last discovered
      await supabaseAdmin
        .from("user_preferences")
        .update({
          last_discovery_at: new Date().toISOString(),
          last_discovery_count: importedJobs.length,
        })
        .eq("user_id", prefs.user_id);

      // Send discovery summary if any new jobs were imported (honor email opt-out;
      // the in-app notification still fires regardless).
      if (importedJobs.length > 0) {
        if ((prefs as { alert_emails_enabled?: boolean }).alert_emails_enabled !== false) {
          sendDiscoverySummary(prefs.user_id, importedJobs).catch(console.error);
        }
        createNotification(
          prefs.user_id,
          "discovery_summary",
          `${importedJobs.length} new job${importedJobs.length === 1 ? "" : "s"} discovered`,
          `We found ${importedJobs.length} matching job${importedJobs.length === 1 ? "" : "s"} for you today.`,
          { count: importedJobs.length }
        ).catch(console.error);
      }
    } catch (err) {
      summary.errors++;
      console.error(`[cron] Discovery failed for user ${prefs.user_id}:`, err);
    }
  }

  console.log("[cron/discover]", summary);
  return NextResponse.json({ ok: true, ...summary });
}
