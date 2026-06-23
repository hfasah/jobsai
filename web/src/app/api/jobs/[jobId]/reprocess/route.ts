import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { processJob } from "@/lib/job-import";

// Re-run the parse pipeline in after() so it survives on serverless.
export const maxDuration = 60;

// POST /api/jobs/[jobId]/reprocess — re-analyze a job that got stuck on
// "processing" (e.g. an old import whose background work was killed). Idempotent:
// re-parses from the stored raw_text and upserts the results.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;

  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id, raw_text")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!job.raw_text) {
    return NextResponse.json({ error: "This job has no saved text to re-analyze. Delete it and import again." }, { status: 400 });
  }

  await supabaseAdmin
    .from("jobs")
    .update({ status: "processing", parse_error_msg: null })
    .eq("id", jobId)
    .eq("user_id", userId);

  after(async () => {
    try {
      await processJob(jobId, userId, job.raw_text as string);
    } catch (err) {
      console.error("reprocess failed:", err);
    }
  });

  return NextResponse.json({ ok: true, status: "processing" });
}
