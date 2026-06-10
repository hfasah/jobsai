import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;
export const revalidate = 0; // No cache - instant matching on profile updates

const MINIMUM_MATCH_THRESHOLD = 112; // Minimum matches to show new users

// GET /api/dashboard/job-matches
// Get job matching stats for current user - personalized based on preferences
// Guarantees minimum 112 matches after profile setup
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

    // First pass: Query with strict preferences
    let strictQuery = supabaseAdmin.from("sample_jobs").select("salary_min", { count: "exact", head: true });
    let hasPreferences = false;

    if (prefs?.locations && Array.isArray(prefs.locations) && prefs.locations.length > 0) {
      strictQuery = strictQuery.in("location", prefs.locations);
      hasPreferences = true;
    }

    if (prefs?.salary_floor) {
      strictQuery = strictQuery.gte("salary_max", prefs.salary_floor);
      hasPreferences = true;
    }

    if (prefs?.job_titles && Array.isArray(prefs.job_titles) && prefs.job_titles.length > 0) {
      strictQuery = strictQuery.in("title", prefs.job_titles);
      hasPreferences = true;
    }

    const { count: strictMatches } = await strictQuery;
    let totalMatches = strictMatches || 0;

    // If strict filters result in < 112 matches, broaden search
    if (totalMatches < MINIMUM_MATCH_THRESHOLD && hasPreferences) {
      // Try broader search - remove salary filter
      const { count: broadMatches } = await supabaseAdmin
        .from("sample_jobs")
        .select("*", { count: "exact", head: true })
        .in("location", prefs?.locations || [])
        .in("title", prefs?.job_titles || []);

      totalMatches = Math.max(totalMatches, broadMatches || 0);
    }

    // Ensure minimum 112 matches for profile-complete users
    if (hasPreferences && totalMatches < MINIMUM_MATCH_THRESHOLD) {
      totalMatches = MINIMUM_MATCH_THRESHOLD;
    }

    // Get jobs for quality breakdown (use original filters)
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

    if (matchedJobs && matchedJobs.length > 0) {
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

    // Distribute remaining matches to maintain minimum threshold
    const currentQualityCount = excellentFit + goodFit + potential;
    if (currentQualityCount < totalMatches) {
      potential += totalMatches - currentQualityCount;
    }

    const gap = totalMatches - (applicationsCount || 0);

    return NextResponse.json({
      total_matches: totalMatches,
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
