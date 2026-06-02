import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { applyToJob } from "@/lib/apply-agent";

export const maxDuration = 60;

// POST /api/approvals/bulk-approve — approve all pending items
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rows } = await supabaseAdmin
    .from("pending_approvals")
    .select("id, job_id")
    .eq("user_id", userId)
    .eq("status", "pending");

  if (!rows || rows.length === 0) {
    return NextResponse.json({ applied: 0, failed: 0 });
  }

  // Mark all as approved first
  await supabaseAdmin
    .from("pending_approvals")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "pending");

  let applied = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const result = await applyToJob(userId, row.job_id);
      const finalStatus = result.status === "submitted" ? "applied" : "failed";
      await supabaseAdmin
        .from("pending_approvals")
        .update({ status: finalStatus })
        .eq("id", row.id);
      if (result.status === "submitted") applied++;
      else failed++;
    } catch {
      await supabaseAdmin
        .from("pending_approvals")
        .update({ status: "failed" })
        .eq("id", row.id);
      failed++;
    }
  }

  return NextResponse.json({ applied, failed, total: rows.length });
}
