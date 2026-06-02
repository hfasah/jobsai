import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { discoverJobs } from "@/lib/job-discovery";
import type { UserPreferences } from "@/types/preferences";

// GET /api/jobs/discover — run job discovery against the user's saved preferences
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Load preferences
  const { data: prefs } = await supabaseAdmin
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!prefs) {
    return NextResponse.json(
      { error: "no_preferences", message: "Set your job preferences first." },
      { status: 422 }
    );
  }

  const noTargets =
    (prefs as UserPreferences).job_titles.length === 0 &&
    (prefs as UserPreferences).keywords.length === 0;

  if (noTargets) {
    return NextResponse.json(
      { error: "no_targets", message: "Add at least one job title or keyword in your preferences." },
      { status: 422 }
    );
  }

  const { jobs, sources, errors } = await discoverJobs(prefs as UserPreferences);

  return NextResponse.json({ data: jobs, sources, errors, count: jobs.length });
}
