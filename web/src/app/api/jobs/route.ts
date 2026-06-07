import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/jobs — list all jobs for the user with parsed title + match score
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select(`
      id, status, source_type, source_url, posting_url, created_at,
      parsed:job_parsed ( title, company, location, seniority ),
      match:job_matches ( match_score )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten match (job_matches is one-to-many; take the highest score)
  const jobs = (data ?? []).map((j) => {
    const matches = (j.match as { match_score: number }[]) ?? [];
    const best = matches.length
      ? matches.reduce((a, b) => (b.match_score > a.match_score ? b : a))
      : null;
    return { ...j, match: best };
  });

  return NextResponse.json({ data: jobs });
}
