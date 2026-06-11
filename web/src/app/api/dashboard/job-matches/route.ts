import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;
export const revalidate = 0; // No cache - instant matching on profile updates

const MINIMUM_MATCH_THRESHOLD = 112; // Minimum matches guaranteed for all users
const TOTAL_JOBS_IN_SYSTEM = 5963188; // Total jobs available across all sources (and counting)

// Map of similar roles users can apply for (realistic career paths & adjacent roles)
// Software Engineer can do: support, QA, DevOps, architecture, mentoring, etc.
const SIMILAR_ROLES: { [key: string]: string[] } = {
  "Software Engineer": [
    // Other engineering roles
    "Backend Engineer", "Frontend Engineer", "Full Stack Engineer", "DevOps Engineer", "Platform Engineer",
    "Systems Engineer", "Site Reliability Engineer", "Solutions Engineer", "Staff Engineer", "Principal Engineer",
    // Support & customer-facing roles
    "Technical Support Engineer", "Application Support", "Tech Support", "Help Desk",
    "Customer Success Engineer", "Customer Support Engineer",
    // Quality & testing
    "QA Engineer", "Quality Assurance", "Test Engineer",
    // Architecture & leadership
    "Solutions Architect", "Software Architect", "Engineering Manager", "Tech Lead",
    // Related technical
    "Systems Administrator", "Cloud Architect", "Security Engineer", "Data Engineer"
  ],
  "Backend Engineer": [
    "Software Engineer", "Full Stack Engineer", "DevOps Engineer", "Systems Engineer", "Platform Engineer",
    "Site Reliability Engineer", "Solutions Architect", "Solutions Engineer", "Technical Support Engineer",
    "Database Administrator", "Cloud Architect", "Security Engineer", "Data Engineer"
  ],
  "Frontend Engineer": [
    "Software Engineer", "Full Stack Engineer", "UX Engineer", "Product Designer", "UX Designer",
    "Solutions Engineer", "Technical Support Engineer", "QA Engineer", "Product Manager"
  ],
  "Data Scientist": [
    "Data Engineer", "ML Engineer", "Machine Learning Engineer", "Analytics Engineer", "Software Engineer",
    "Backend Engineer", "Solutions Engineer", "Business Analyst", "Research Engineer"
  ],
  "Data Engineer": [
    "Data Scientist", "ML Engineer", "Software Engineer", "Backend Engineer", "Analytics Engineer",
    "Systems Engineer", "DevOps Engineer", "Database Administrator", "Solutions Engineer"
  ],
  "Product Manager": [
    "Engineering Manager", "Tech Lead", "Product Designer", "Product Analyst",
    "Solutions Engineer", "Customer Success Engineer", "Business Analyst"
  ],
  "Designer": [
    "UX Designer", "Product Designer", "Frontend Engineer", "Product Manager",
    "Solutions Engineer", "Customer Success Engineer"
  ],
  "Manager": [
    "Engineering Manager", "Tech Lead", "Staff Engineer", "Principal Engineer",
    "Solutions Architect", "Product Manager", "Director"
  ],
  "QA": [
    "QA Engineer", "Software Engineer", "Test Engineer", "Automation Engineer",
    "Quality Assurance", "DevOps Engineer", "Technical Support Engineer"
  ],
  "Support": [
    "Technical Support Engineer", "Application Support", "Customer Success Engineer",
    "Solutions Engineer", "Software Engineer", "Help Desk", "Tech Support"
  ]
};

// Get similar job titles for a given role
function getSimilarRoles(title: string): string[] {
  const lowerTitle = title.toLowerCase();

  for (const [key, similar] of Object.entries(SIMILAR_ROLES)) {
    if (lowerTitle.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerTitle)) {
      return [title, ...similar];
    }
  }

  // If no similar roles found, return the original title
  return [title];
}

// GET /api/dashboard/job-matches
// Get job matching stats for current user - personalized based on preferences
// Shows similar/related roles users can apply for, guarantees minimum 112 matches
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Get user's job preferences
    const { data: prefs } = await supabaseAdmin
      .from("user_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

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

    // Profile-completion gate. Per spec: a new user starts at 0 and only unlocks
    // the guaranteed minimum (112+) once their profile is complete — résumé, job
    // preferences, and apply profile. Before that we honestly show 0.
    const [resumeCountRes, applyProfileRes] = await Promise.all([
      supabaseAdmin
        .from("resume_documents")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_archived", false),
      supabaseAdmin
        .from("apply_profiles")
        .select("first_name, email")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    const hasResume = (resumeCountRes.count ?? 0) > 0;
    const hasJobTitles = Array.isArray(prefs?.job_titles) && prefs.job_titles.length > 0;
    const hasApplyProfile = !!(applyProfileRes.data?.first_name || applyProfileRes.data?.email);
    const profileComplete = hasResume && hasJobTitles && hasApplyProfile;

    if (!profileComplete) {
      return NextResponse.json({
        total_matches: 0,
        applications_submitted: applicationsCount || 0,
        pending_applications: pendingCount || 0,
        opportunity_gap: 0,
        match_breakdown: { excellent_fit: 0, good_fit: 0, potential: 0 },
        total_jobs_in_system: TOTAL_JOBS_IN_SYSTEM,
        last_updated: new Date().toISOString(),
      });
    }

    let hasPreferences = false;
    let allSimilarRoles: string[] = [];

    // Build list of all titles (exact + similar) user can apply for
    if (prefs?.job_titles && Array.isArray(prefs.job_titles) && prefs.job_titles.length > 0) {
      hasPreferences = true;
      allSimilarRoles = Array.from(
        new Set(
          prefs.job_titles.flatMap((title: string) => getSimilarRoles(title))
        )
      );
    }

    // First pass: Query with location + similar roles (flexible salary)
    let query = supabaseAdmin.from("sample_jobs").select("salary_min", { count: "exact", head: true });

    // Always filter by location if specified (relaxed)
    if (prefs?.locations && Array.isArray(prefs.locations) && prefs.locations.length > 0) {
      query = query.in("location", prefs.locations);
    } else {
      // If no location preference, show all locations
      hasPreferences = true;
    }

    // Filter by similar/related roles
    if (allSimilarRoles.length > 0) {
      query = query.in("title", allSimilarRoles);
    }

    // Apply salary floor with 10% buffer for flexibility
    if (prefs?.salary_floor) {
      const salaryWithBuffer = Math.round(prefs.salary_floor * 0.9);
      query = query.gte("salary_max", salaryWithBuffer);
    }

    const { count: strictMatches } = await query;
    let totalMatches = strictMatches || 0;

    // Second pass: If still below threshold, broaden even more
    if (totalMatches < MINIMUM_MATCH_THRESHOLD && hasPreferences) {
      // Remove salary filter, keep location + roles
      let broadQuery = supabaseAdmin.from("sample_jobs").select("salary_min", { count: "exact", head: true });

      if (prefs?.locations && Array.isArray(prefs.locations) && prefs.locations.length > 0) {
        broadQuery = broadQuery.in("location", prefs.locations);
      }

      if (allSimilarRoles.length > 0) {
        broadQuery = broadQuery.in("title", allSimilarRoles);
      }

      const { count: broadMatches } = await broadQuery;
      totalMatches = Math.max(totalMatches, broadMatches || 0);
    }

    // Third pass: If still below threshold, show all roles in preferred locations
    if (totalMatches < MINIMUM_MATCH_THRESHOLD && hasPreferences && prefs?.locations?.length > 0) {
      const { count: allRoleMatches } = await supabaseAdmin
        .from("sample_jobs")
        .select("*", { count: "exact", head: true })
        .in("location", prefs.locations);

      totalMatches = Math.max(totalMatches, allRoleMatches || 0);
    }

    // Final fallback: Show all jobs
    if (totalMatches < MINIMUM_MATCH_THRESHOLD) {
      const { count: allMatches } = await supabaseAdmin
        .from("sample_jobs")
        .select("*", { count: "exact", head: true });

      totalMatches = Math.max(totalMatches, allMatches || 0);
    }

    // Guaranteed minimum: a set-up profile always sees at least 112 matches,
    // even if the sample catalog itself is smaller. (Profile completeness was
    // already verified above; new/incomplete users returned 0 earlier.)
    totalMatches = Math.max(totalMatches, MINIMUM_MATCH_THRESHOLD);

    // Get jobs for quality breakdown
    let query2 = supabaseAdmin.from("sample_jobs").select("salary_min");
    if (prefs?.locations && Array.isArray(prefs.locations) && prefs.locations.length > 0) {
      query2 = query2.in("location", prefs.locations);
    }
    if (allSimilarRoles.length > 0) {
      query2 = query2.in("title", allSimilarRoles);
    }

    const { data: matchedJobs } = await query2;

    // Categorize by match quality
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
        } else if (jobSalary >= salaryFloor * 0.95) {
          goodFit++;
        } else {
          potential++;
        }
      });
    }

    // Distribute remaining matches
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
      total_jobs_in_system: TOTAL_JOBS_IN_SYSTEM, // Show platform scale
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
