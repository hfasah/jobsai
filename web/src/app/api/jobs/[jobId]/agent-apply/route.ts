import { auth } from "@clerk/nextjs/server";
import { blockNonJobSeeker } from "@/lib/roles";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { createSkyvernTask, getSkyvernKey } from "@/lib/skyvern";
import { checkAutoApplyGate } from "@/lib/billing";
import { checkJobAvailability, expiredMessage } from "@/lib/job-availability";
import { createNotification } from "@/lib/notifications";

export const maxDuration = 30;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work").replace(/\/$/, "");

// POST /api/jobs/[jobId]/agent-apply — launch browser agent to apply on any platform
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;
  const { jobId } = await params;

  if (!getSkyvernKey()) {
    return NextResponse.json({ error: "Agent apply is not configured on this server." }, { status: 503 });
  }

  const gate = await checkAutoApplyGate(userId);
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason, upgrade_required: true }, { status: 402 });
  }

  // Verify the user has access: they own the job OR have it in their applications pipeline
  const [{ data: jobOwned }, { data: appRecord }] = await Promise.all([
    supabaseAdmin.from("jobs").select("id").eq("id", jobId).eq("user_id", userId).maybeSingle(),
    supabaseAdmin.from("applications").select("job_id").eq("job_id", jobId).eq("user_id", userId).maybeSingle(),
  ]);

  if (!jobOwned && !appRecord) {
    return NextResponse.json(
      { error: "Job not found in your account. If this job was recently added, try refreshing the page.", action: "refresh" },
      { status: 404 }
    );
  }

  // Fetch full job details — join job_parsed to get posting_url (stored there by processJob)
  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id, status, source_url, posting_url, job_parsed ( title, company, posting_url )")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json(
      { error: "This job no longer exists. Remove it from your pipeline and re-import from the original posting.", action: "remove_job" },
      { status: 404 }
    );
  }

  const parsed = Array.isArray(job.job_parsed) ? job.job_parsed[0] : job.job_parsed;

  // URL can be on jobs.source_url, jobs.posting_url, or job_parsed.posting_url
  const applicationUrl = job.source_url || job.posting_url || parsed?.posting_url || null;

  if (!applicationUrl) {
    return NextResponse.json(
      { error: "No application URL found. Open this job and make sure the original posting link is saved.", action: "view_job" },
      { status: 400 }
    );
  }

  const jobTitle = parsed?.title ?? null;
  const jobCompany = parsed?.company ?? null;

  // Check if the posting is still live before wasting an agent run
  const availability = await checkJobAvailability(applicationUrl);
  if (availability === "expired") {
    // Mark in DB so we don't check again
    await supabaseAdmin.from("jobs").update({ status: "expired" }).eq("id", jobId);
    return NextResponse.json(
      {
        error: expiredMessage(jobCompany),
        expired: true,
        action: "remove_job",
      },
      { status: 410 }
    );
  }

  // Load apply profile
  const { data: profile } = await supabaseAdmin
    .from("apply_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile?.email || !profile?.first_name) {
    return NextResponse.json(
      { error: "Complete your Apply Profile first (name + email required).", upgrade_required: false },
      { status: 422 }
    );
  }

  // Get active resume version + generate a 1-hour signed URL for Skyvern to download
  const { data: doc } = await supabaseAdmin
    .from("resume_documents")
    .select("active_version_id, resume_versions!resume_documents_active_version_id_fkey(storage_key)")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .eq("is_archived", false)
    .maybeSingle();

  let resumeUrl: string | undefined;
  const storageKey = (doc?.resume_versions as { storage_key?: string } | null)?.storage_key;
  if (storageKey) {
    const { data: signed } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storageKey, 3600); // 1-hour URL for Skyvern to download
    if (signed?.signedUrl) resumeUrl = signed.signedUrl;
  }

  // Get cover letter if one was prepared
  const { data: cl } = await supabaseAdmin
    .from("cover_letters")
    .select("body")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Build Skyvern task
  const navigationPayload: Record<string, string | null> = {
    first_name: profile.first_name,
    last_name: profile.last_name ?? null,
    email: profile.email,
    phone: profile.phone ?? null,
    city: profile.city ?? null,
    country: profile.country ?? null,
    linkedin_url: profile.linkedin_url ?? null,
    github_url: profile.github_url ?? null,
    portfolio_url: profile.portfolio_url ?? null,
    authorized_to_work: profile.authorized_to_work ? "Yes" : "No",
    requires_sponsorship: profile.requires_sponsorship ? "Yes" : "No",
  };

  try {
    const task = await createSkyvernTask({
      url: applicationUrl,
      webhookCallbackUrl: `${APP_URL}/api/webhooks/agent-apply`,
      navigationPayload,
      resumeUrl,
      coverLetter: cl?.body ?? undefined,
    });

    // Record the attempt
    await supabaseAdmin.from("apply_attempts").insert({
      user_id: userId,
      job_id: jobId,
      platform: "agent",
      status: "agent_running",
      submitted_at: null,
      error_msg: `Skyvern task: ${task.task_id}`,
    });

    // Save task reference so webhook can update
    await supabaseAdmin.from("agent_apply_tasks").insert({
      task_id: task.task_id,
      user_id: userId,
      job_id: jobId,
    });

    createNotification(
      userId,
      "agent_apply_started",
      "Browser agent is applying",
      `Agent started applying to ${jobTitle ?? "a role"} at ${jobCompany ?? "a company"}. We'll notify you when done.`,
      { job_id: jobId }
    ).catch(console.error);

    return NextResponse.json({
      ok: true,
      task_id: task.task_id,
      message: "Browser agent launched — it will apply on your behalf and notify you when done.",
    });
  } catch (err) {
    console.error("[agent-apply]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent apply failed." },
      { status: 500 }
    );
  }
}

// GET /api/jobs/[jobId]/agent-apply — check agent status
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { jobId } = await params;

  const { data } = await supabaseAdmin
    .from("apply_attempts")
    .select("status, error_msg, created_at")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .eq("platform", "agent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ data });
}
