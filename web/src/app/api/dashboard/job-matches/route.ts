import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;
export const revalidate = 60; // Cache for 1 minute - fresh data per user

// GET /api/dashboard/job-matches
// Get job matching stats for current user - personalized based on preferences
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Get user's job preferences
    const { data: prefs } = await supabaseAdmin
      .from("user_job_preferences")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Get applications submitted
    const { count: applicationsCount } = await supabaseAdmin
      .from("applications")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .eq("status", "applied");

    // Get pending/in-progress applications
    const { count: pendingCount } = await supabaseAdmin
      .from("applications")
      .select("id", { count: "exact" })
      .eq("user_id", userId)
      .in("status", ["in_progress", "interview_scheduled"]);

    // Query actual sample jobs with filters based on user preferences
    let query = supabaseAdmin.from("sample_jobs").select("*", { count: "exact", head: true });

    // Filter by locations if specified
    if (prefs?.locations && Array.isArray(prefs.locations) && prefs.locations.length > 0) {
      query = query.in("location", prefs.locations);
    }

    // Filter by salary floor if specified
    if (prefs?.salary_floor) {
      query = query.gte("salary_max", prefs.salary_floor);
    }

    // Filter by job titles if specified
    if (prefs?.job_titles && Array.isArray(prefs.job_titles) && prefs.job_titles.length > 0) {
      query = query.in("title", prefs.job_titles);
    }

    const { count: totalMatches } = await query;

    // Get jobs for quality breakdown
    let query2 = supabaseAdmin.from("sample_jobs").select("salary_min");
    if (prefs?.locations && Array.isArray(prefs.locations) && prefs.locations.length > 0) {
      query2 = query2.in("location", prefs.locations);
    }
    if (prefs?.job_titles && Array.isArray(prefs.job_titles) && prefs.job_titles.length > 0) {
      query2 = query2.in("title", prefs.job_titles);
    }

    const { data: matchedJobs } = await query2;

    // Categorize by match quality (based on salary alignment with preferences)
    let excellentFit = 0;
    let goodFit = 0;
    let potential = 0;

    const salaryFloor = prefs?.salary_floor ?? 80000;
    const salaryTarget = prefs?.salary_target ?? 120000;

    if (matchedJobs) {
      matchedJobs.forEach((job) => {
        const jobSalary = job.salary_min || 80000;
        if (jobSalary >= salaryTarget) {
          excellentFit++;
        } else if (jobSalary >= salaryFloor) {
          goodFit++;
        } else {
          potential++;
        }
      });
    }

    const gap = (totalMatches || 0) - (applicationsCount || 0);

    return NextResponse.json({
      total_matches: totalMatches || 0,
      applications_submitted: applicationsCount || 0,
      pending_applications: pendingCount || 0,
      opportunity_gap: Math.max(0, gap),
      match_breakdown: {
        excellent_fit: excellentFit,
        good_fit: goodFit,
        potential: potential,
      },
      last_updated: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Job matches error:", err);
    return NextResponse.json(
      { error: "Failed to calculate job matches" },
      { status: 500 }
    );
  }
}
