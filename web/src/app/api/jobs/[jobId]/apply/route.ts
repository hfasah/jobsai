import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { applyToJob } from "@/lib/apply-agent";
import { checkAutoApplyGate } from "@/lib/billing";

// GET /api/jobs/[jobId]/apply — fetch the latest apply attempt for this job
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { jobId } = await params;

  const { data } = await supabaseAdmin
    .from("apply_attempts")
    .select("*")
    .eq("job_id", jobId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ data: data ?? null });
}

// POST /api/jobs/[jobId]/apply — trigger auto-apply for this job
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { jobId } = await params;

  const gate = await checkAutoApplyGate(userId);
  if (!gate.allowed) {
    return NextResponse.json({ error: gate.reason, upgrade_required: true }, { status: 402 });
  }

  // Verify job belongs to user
  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id, status")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  if (job.status !== "ready") {
    return NextResponse.json({ error: "Job is still processing." }, { status: 409 });
  }

  try {
    const result = await applyToJob(userId, jobId);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("Apply error:", err);
    return NextResponse.json({ error: "Apply failed. Please try again." }, { status: 500 });
  }
}
