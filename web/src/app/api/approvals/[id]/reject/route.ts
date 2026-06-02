import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/approvals/[id]/reject
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: approval } = await supabaseAdmin
    .from("pending_approvals")
    .select("id, status")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!approval) return NextResponse.json({ error: "Approval not found." }, { status: 404 });
  if (approval.status !== "pending") {
    return NextResponse.json({ error: "Already reviewed." }, { status: 409 });
  }

  await supabaseAdmin
    .from("pending_approvals")
    .update({ status: "rejected", reviewed_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
