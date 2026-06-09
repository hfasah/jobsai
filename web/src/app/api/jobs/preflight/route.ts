import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { checkJobAvailability } from "@/lib/job-availability";

export const maxDuration = 60;

// POST /api/jobs/preflight — check a list of job IDs before bulk apply
// Returns: { results: [{ jobId, status: 'ready'|'expired'|'no_url'|'not_found' }] }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const jobIds: string[] = Array.isArray(body.job_ids) ? body.job_ids.slice(0, 30) : [];

  if (jobIds.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // Fetch all jobs — join job_parsed for title, company, and posting_url
  const { data: jobs } = await supabaseAdmin
    .from("jobs")
    .select("id, source_url, posting_url, status, user_id, job_parsed ( title, company, posting_url )")
    .in("id", jobIds);

  const jobMap = new Map((jobs ?? []).map((j) => [j.id, j]));

  // Check ownership via applications table for jobs not owned directly
  const unownedIds = jobIds.filter((id) => {
    const j = jobMap.get(id);
    return !j || j.user_id !== userId;
  });

  const appOwned = new Set<string>();
  if (unownedIds.length > 0) {
    const { data: apps } = await supabaseAdmin
      .from("applications")
      .select("job_id")
      .eq("user_id", userId)
      .in("job_id", unownedIds);
    (apps ?? []).forEach((a) => appOwned.add(a.job_id));
  }

  // Check availability in parallel (cap at 10 concurrent)
  const results = await Promise.all(
    jobIds.map(async (jobId) => {
      const job = jobMap.get(jobId);

      if (!job && !appOwned.has(jobId)) {
        return { jobId, status: "not_found" as const, title: null, company: null };
      }

      const owned = job?.user_id === userId || appOwned.has(jobId);
      if (!owned) {
        return { jobId, status: "not_found" as const, title: null, company: null };
      }

      // title/company live in job_parsed; posting_url may be there too
      const parsedRow = Array.isArray(job?.job_parsed) ? job?.job_parsed[0] : job?.job_parsed;
      const title = parsedRow?.title ?? null;
      const company = parsedRow?.company ?? null;
      const applicationUrl = job?.source_url || job?.posting_url || parsedRow?.posting_url || null;

      if (!applicationUrl) {
        return { jobId, status: "no_url" as const, title, company };
      }

      if (job?.status === "expired") {
        return { jobId, status: "expired" as const, title, company };
      }

      // Check live availability
      const availability = await checkJobAvailability(applicationUrl);
      if (availability === "expired") {
        await supabaseAdmin.from("jobs").update({ status: "expired" }).eq("id", jobId);
        return { jobId, status: "expired" as const, title, company };
      }

      return { jobId, status: "ready" as const, title, company };
    })
  );

  return NextResponse.json({ results });
}
