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

  // Attach "what's been done" flags so My Jobs shows saved progress and users
  // can resume work / review reports after logging back in.
  const ids = jobs.map((j) => j.id as string);
  if (ids.length > 0) {
    const [tailored, covers, ats, applied, sessions] = await Promise.all([
      supabaseAdmin.from("tailored_resumes").select("job_id").eq("user_id", userId).in("job_id", ids),
      supabaseAdmin.from("cover_letters").select("job_id").eq("user_id", userId).in("job_id", ids),
      supabaseAdmin.from("ats_scans").select("job_id").eq("user_id", userId).in("job_id", ids),
      supabaseAdmin.from("apply_attempts").select("job_id").eq("user_id", userId).eq("status", "submitted").in("job_id", ids),
      supabaseAdmin.from("interview_sessions").select("job_id").eq("user_id", userId).in("job_id", ids),
    ]);
    const setOf = (rows: { job_id: string }[] | null) => new Set((rows ?? []).map((r) => r.job_id));
    const tSet = setOf(tailored.data), cSet = setOf(covers.data), aSet = setOf(ats.data), apSet = setOf(applied.data), sSet = setOf(sessions.data);
    jobs.forEach((j) => {
      const id = j.id as string;
      (j as Record<string, unknown>).progress = {
        tailored: tSet.has(id),
        cover: cSet.has(id),
        ats: aSet.has(id),
        applied: apSet.has(id),
        report: sSet.has(id),
      };
    });
  }

  return NextResponse.json({ data: jobs });
}
