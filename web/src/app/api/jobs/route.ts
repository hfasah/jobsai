import { auth } from "@clerk/nextjs/server";
import { blockNonJobSeeker } from "@/lib/roles";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resolvePendingAgentTasks } from "@/lib/agent-apply-resolve";

// GET /api/jobs — list all jobs for the user with parsed title + match score
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const roleBlock = await blockNonJobSeeker(userId); if (roleBlock) return roleBlock;

  // Settle in-flight agent applies so the "applied" flags reflect real outcomes.
  await resolvePendingAgentTasks(userId).catch(() => {});

  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select(`
      id, status, source_type, source_url, created_at,
      parsed:job_parsed ( title, company, location, seniority, posting_url ),
      match:job_matches ( match_score )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Flatten match (job_matches is one-to-many; take the highest score).
  // posting_url lives on job_parsed, so lift it to the top level for the client.
  const jobs = (data ?? []).map((j) => {
    const matches = (j.match as { match_score: number }[]) ?? [];
    const best = matches.length
      ? matches.reduce((a, b) => (b.match_score > a.match_score ? b : a))
      : null;
    const parsed = Array.isArray(j.parsed) ? j.parsed[0] : j.parsed;
    return { ...j, posting_url: (parsed as { posting_url?: string } | null)?.posting_url ?? null, match: best };
  });

  // Attach "what's been done" flags so My Jobs shows saved progress and users
  // can resume work / review reports after logging back in.
  const ids = jobs.map((j) => j.id as string);
  if (ids.length > 0) {
    const [tailored, covers, ats, applied, sessions, pipeline, confirmed] = await Promise.all([
      supabaseAdmin.from("tailored_resumes").select("job_id").eq("user_id", userId).in("job_id", ids),
      supabaseAdmin.from("cover_letters").select("job_id").eq("user_id", userId).in("job_id", ids),
      supabaseAdmin.from("ats_scans").select("job_id").eq("user_id", userId).in("job_id", ids),
      supabaseAdmin.from("apply_attempts").select("job_id").eq("user_id", userId).eq("status", "submitted").in("job_id", ids),
      supabaseAdmin.from("interview_sessions").select("job_id").eq("user_id", userId).in("job_id", ids),
      // Durable "applied" signal: any pipeline card past the saved stage.
      supabaseAdmin.from("applications").select("job_id, stage").eq("user_id", userId).in("job_id", ids),
      // Employer "Application received" confirmation captured in the inbox — proof
      // the application actually landed with the company.
      supabaseAdmin.from("inbox_messages").select("job_id").eq("user_id", userId).eq("classification", "confirmation").in("job_id", ids),
    ]);
    const setOf = (rows: { job_id: string }[] | null) => new Set((rows ?? []).map((r) => r.job_id));
    const tSet = setOf(tailored.data), cSet = setOf(covers.data), aSet = setOf(ats.data), sSet = setOf(sessions.data);
    const confirmedSet = setOf(confirmed.data);
    // A job counts as applied if it has a submitted attempt OR a pipeline card
    // that's moved beyond "saved" (covers agent applies confirmed at launch), OR
    // the employer emailed a confirmation.
    const apSet = setOf(applied.data);
    (pipeline.data ?? []).forEach((r) => {
      if (r.stage && r.stage !== "saved") apSet.add(r.job_id as string);
    });
    confirmedSet.forEach((id) => apSet.add(id));
    jobs.forEach((j) => {
      const id = j.id as string;
      (j as Record<string, unknown>).progress = {
        tailored: tSet.has(id),
        cover: cSet.has(id),
        ats: aSet.has(id),
        applied: apSet.has(id),
        confirmed: confirmedSet.has(id),
        report: sSet.has(id),
      };
    });
  }

  return NextResponse.json({ data: jobs });
}
