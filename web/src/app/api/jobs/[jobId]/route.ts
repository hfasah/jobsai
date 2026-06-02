import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/jobs/[jobId] — full job with parsed fields + match
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;

  const { data: job, error } = await supabaseAdmin
    .from("jobs")
    .select(`
      *,
      parsed:job_parsed (*),
      match:job_matches (*)
    `)
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (error || !job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // job_matches is one-to-many; expose the best as `match`
  const matches = (job.match as { match_score: number }[]) ?? [];
  const best = matches.length
    ? matches.reduce((a, b) => (b.match_score > a.match_score ? b : a))
    : null;

  return NextResponse.json({ data: { ...job, match: best } });
}

// DELETE /api/jobs/[jobId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;

  const { error } = await supabaseAdmin
    .from("jobs")
    .delete()
    .eq("id", jobId)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
