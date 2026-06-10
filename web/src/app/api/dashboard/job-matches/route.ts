import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;
export const revalidate = 3600; // Cache for 1 hour

// GET /api/dashboard/job-matches
// Get job matching stats for current user
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

    // Get user's resume to extract skills
    const { data: resumes } = await supabaseAdmin
      .from("resume_documents")
      .select("parsed_text")
      .eq("user_id", userId)
      .eq("is_archived", false);

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

    // Calculate matching jobs
    // In a real system, this would:
    // 1. Extract skills from resume
    // 2. Query job database with preference filters
    // 3. Score each job based on match criteria
    // 4. Return categorized results

    // For now, return estimated matches based on heuristics
    const totalMatches = calculateEstimatedMatches(prefs, resumes ?? []);
    const excellentFit = Math.round(totalMatches * 0.17); // ~17%
    const goodFit = Math.round(totalMatches * 0.38); // ~38%
    const potential = Math.round(totalMatches * 0.45); // ~45%

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

/**
 * Estimate matching jobs based on user profile
 * Real implementation would use actual job database
 */
function calculateEstimatedMatches(
  prefs: any,
  resumes: any[]
): number {
  // Base calculation
  let estimate = 800;

  // Adjust based on location preferences (more restrictive = fewer matches)
  if (prefs?.locations && Array.isArray(prefs.locations)) {
    const locationCount = prefs.locations.length;
    if (locationCount === 1) estimate *= 0.6; // Single location
    else if (locationCount <= 3) estimate *= 0.8; // Few locations
    // Multiple locations = higher matches
  }

  // Adjust based on salary requirements (higher salary = fewer matches)
  if (prefs?.salary_floor) {
    if (prefs.salary_floor >= 200000) estimate *= 0.5;
    else if (prefs.salary_floor >= 150000) estimate *= 0.7;
    else if (prefs.salary_floor >= 100000) estimate *= 0.85;
  }

  // Adjust based on job titles (more specific = fewer matches)
  if (prefs?.job_titles && Array.isArray(prefs.job_titles)) {
    const titleCount = prefs.job_titles.length;
    if (titleCount === 1) estimate *= 0.7;
    else if (titleCount <= 3) estimate *= 0.85;
  }

  // Check for resume/skills
  if (!resumes || resumes.length === 0) {
    estimate *= 0.5; // Lower matches without skills data
  }

  // Round to reasonable number
  return Math.max(100, Math.round(estimate));
}
