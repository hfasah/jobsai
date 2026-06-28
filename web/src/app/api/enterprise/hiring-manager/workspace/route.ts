import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, getMyMembership } from "@/lib/enterprise";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const membership = await getMyMembership(userId);
  if (!membership) return NextResponse.json({ error: "Not a member." }, { status: 403 });

  // Get user's email so we can match interview invites
  const clerk = await clerkClient();
  let userEmail = "";
  try {
    const user = await clerk.users.getUser(userId);
    userEmail = user.emailAddresses[0]?.emailAddress ?? "";
  } catch { /* ignore */ }

  // 1. Roles I manage. Owners/admins manage the whole org, so they see every
  //    active role; hiring managers / recruiters see roles where they're the
  //    assigned hiring manager OR which they created.
  const isOwnerAdmin = membership.role === "owner" || membership.role === "admin";
  let myJobsQuery = supabaseAdmin
    .from("enterprise_jobs")
    .select("id,title,department,location,status,created_at,hiring_manager_id")
    .eq("org_id", org.id)
    .in("status", ["active", "paused"])
    .order("created_at", { ascending: false })
    .limit(50);
  if (!isOwnerAdmin) myJobsQuery = myJobsQuery.or(`hiring_manager_id.eq.${userId},created_by.eq.${userId}`);
  const { data: myJobs } = await myJobsQuery;

  const jobIds = (myJobs ?? []).map((j) => j.id);

  // For each job, count candidates at each stage
  const { data: stageCounts } = jobIds.length > 0
    ? await supabaseAdmin
        .from("enterprise_applications")
        .select("job_id,stage")
        .in("job_id", jobIds)
        .not("stage", "eq", "rejected")
    : { data: [] };

  const jobsWithCounts = (myJobs ?? []).map((job) => {
    const apps = (stageCounts ?? []).filter((a) => a.job_id === job.id);
    return {
      ...job,
      total_applicants: apps.length,
      awaiting_decision: apps.filter((a) => ["interview", "screened"].includes(a.stage)).length,
      offer_stage: apps.filter((a) => a.stage === "offer").length,
      hired: apps.filter((a) => a.stage === "hired").length,
    };
  });

  // 2. Candidates awaiting HM decision — interview/offer stage on my jobs
  const { data: pendingApps } = jobIds.length > 0
    ? await supabaseAdmin
        .from("enterprise_applications")
        .select("id,candidate_name,candidate_email,stage,match_score,skills_score,experience_score,ai_recommendation,ai_summary,notes,hm_decision,hm_notes,tags,risk_flags,resume_url,resume_storage_key,source,created_at,stage_updated_at,assigned_to, job:enterprise_jobs(id,title)")
        .in("job_id", jobIds)
        .in("stage", ["screened", "interview", "offer"])
        .is("hm_decision", null)
        .order("match_score", { ascending: false })
        .limit(50)
    : { data: [] };

  // 2b. Candidates directly assigned to this HM (any job/stage) — the
  // "send to hiring manager" flow. Merged with the job-based list, de-duped.
  const { data: assignedApps } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id,candidate_name,candidate_email,stage,match_score,skills_score,experience_score,ai_recommendation,ai_summary,notes,hm_decision,hm_notes,tags,risk_flags,resume_url,resume_storage_key,source,created_at,stage_updated_at,assigned_to, job:enterprise_jobs(id,title)")
    .eq("org_id", org.id)
    .eq("assigned_to", userId)
    .is("hm_decision", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const seenAppIds = new Set((pendingApps ?? []).map((a) => a.id));
  const allPending = [...(pendingApps ?? []), ...((assignedApps ?? []).filter((a) => !seenAppIds.has(a.id)))];

  // 3. Interviews involving this user (by email or userId as created_by)
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAhead = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const { data: upcomingInterviews } = await supabaseAdmin
    .from("enterprise_interview_schedule")
    .select("id,candidate_name,candidate_email,title,scheduled_at,duration_min,meeting_link,status,interview_type,application_id, job:enterprise_jobs(id,title)")
    .eq("org_id", org.id)
    .gte("scheduled_at", `${today}T00:00:00`)
    .lte("scheduled_at", sevenDaysAhead)
    .neq("status", "cancelled")
    .or(userEmail ? `created_by.eq.${userId},interviewer_emails.cs.{"${userEmail}"}` : `created_by.eq.${userId}`)
    .order("scheduled_at")
    .limit(20);

  // 4. Interviews needing feedback — completed but no feedback from this user
  const { data: completedInterviews } = await supabaseAdmin
    .from("enterprise_interview_schedule")
    .select("id,candidate_name,scheduled_at,application_id, job:enterprise_jobs(id,title)")
    .eq("org_id", org.id)
    .eq("status", "completed")
    .or(userEmail ? `created_by.eq.${userId},interviewer_emails.cs.{"${userEmail}"}` : `created_by.eq.${userId}`)
    .gte("scheduled_at", new Date(Date.now() - 14 * 86_400_000).toISOString())
    .order("scheduled_at", { ascending: false })
    .limit(20);

  // Filter out those where this user already submitted feedback
  const completedIds = (completedInterviews ?? []).map((i) => i.id);
  let pendingFeedback = completedInterviews ?? [];

  if (completedIds.length > 0) {
    const { data: existingFeedback } = await supabaseAdmin
      .from("enterprise_interview_feedback")
      .select("interview_id")
      .in("interview_id", completedIds)
      .eq("submitted_by", userId);

    const feedbackDone = new Set((existingFeedback ?? []).map((f) => f.interview_id));
    pendingFeedback = pendingFeedback.filter((i) => !feedbackDone.has(i.id));
  }

  // Stats
  const stats = {
    my_jobs: jobsWithCounts.length,
    awaiting_decision: allPending.length,
    upcoming_interviews: (upcomingInterviews ?? []).length,
    pending_feedback: pendingFeedback.length,
  };

  return NextResponse.json({
    stats,
    jobs: jobsWithCounts,
    pending_applications: allPending,
    upcoming_interviews: upcomingInterviews ?? [],
    pending_feedback: pendingFeedback,
    role: membership.role,
  });
}
