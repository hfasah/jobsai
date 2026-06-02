import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { applyToJob } from "@/lib/apply-agent";

export const maxDuration = 60;

// POST /api/approvals/[id]/approve
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: approval } = await supabaseAdmin
    .from("pending_approvals")
    .select("id, job_id, status")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!approval) return NextResponse.json({ error: "Approval not found." }, { status: 404 });
  if (approval.status !== "pending") {
    return NextResponse.json({ error: "Already reviewed." }, { status: 409 });
  }

  // Mark as approved
  await supabaseAdmin
    .from("pending_approvals")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", id);

  // Fire the apply pipeline
  try {
    const result = await applyToJob(userId, approval.job_id);

    // Update status to reflect apply outcome
    const finalStatus = result.status === "submitted" ? "applied" : "failed";
    await supabaseAdmin
      .from("pending_approvals")
      .update({ status: finalStatus })
      .eq("id", id);

    return NextResponse.json({ data: result });
  } catch (err) {
    await supabaseAdmin
      .from("pending_approvals")
      .update({ status: "failed" })
      .eq("id", id);
    const msg = err instanceof Error ? err.message : "Apply failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
