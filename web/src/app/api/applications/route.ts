import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { ApplicationStage } from "@/types/application";
import { APPLICATION_STAGES } from "@/types/application";

type ParsedRel = { title: string | null; company: string | null; location: string | null };
type MatchRel = { match_score: number };
type JobRel = {
  id: string;
  parsed: ParsedRel | ParsedRel[] | null;
  match: MatchRel[] | null;
};

function summarizeJob(job: JobRel | JobRel[] | null) {
  const j = Array.isArray(job) ? job[0] : job;
  if (!j) return null;
  const parsed = Array.isArray(j.parsed) ? j.parsed[0] : j.parsed;
  const matches = j.match ?? [];
  const best = matches.length
    ? matches.reduce((a, b) => (b.match_score > a.match_score ? b : a))
    : null;
  return {
    id: j.id,
    title: parsed?.title ?? null,
    company: parsed?.company ?? null,
    location: parsed?.location ?? null,
    match_score: best?.match_score ?? null,
  };
}

// GET /api/applications — list the user's pipeline cards with a job summary
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("applications")
    .select(`
      *,
      job:jobs ( id, parsed:job_parsed ( title, company, location ), match:job_matches ( match_score ) )
    `)
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const applications = (data ?? []).map((a) => ({
    ...a,
    job: summarizeJob(a.job as JobRel | JobRel[] | null),
  }));

  return NextResponse.json({ data: applications });
}

// POST /api/applications — add a job to the tracker
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const jobId: string | undefined = body.job_id;
  const stage: ApplicationStage =
    body.stage && APPLICATION_STAGES.includes(body.stage) ? body.stage : "saved";

  if (!jobId) return NextResponse.json({ error: "job_id is required" }, { status: 400 });

  // Verify the job belongs to the user
  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();
  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("applications")
    .insert({
      user_id: userId,
      job_id: jobId,
      stage,
      applied_at: stage === "saved" ? null : now,
      stage_history: [{ stage, at: now }],
    })
    .select()
    .single();

  // Unique violation → already tracked; return the existing card instead of erroring
  if (error?.code === "23505") {
    const { data: existing } = await supabaseAdmin
      .from("applications")
      .select("*")
      .eq("user_id", userId)
      .eq("job_id", jobId)
      .single();
    return NextResponse.json({ data: existing, dedup: true });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}
