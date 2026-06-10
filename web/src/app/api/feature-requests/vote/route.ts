import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;

// POST /api/feature-requests/vote
// Upvote a feature request
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { request_id } = body as any;

  if (!request_id) {
    return NextResponse.json({ error: "request_id required" }, { status: 400 });
  }

  try {
    // Check if already voted
    const { data: existingVote } = await supabaseAdmin
      .from("feature_request_votes")
      .select("id")
      .eq("user_id", userId)
      .eq("request_id", request_id)
      .maybeSingle();

    if (existingVote) {
      return NextResponse.json(
        { error: "Already voted on this request" },
        { status: 409 }
      );
    }

    // Insert vote
    const { error: voteError } = await supabaseAdmin
      .from("feature_request_votes")
      .insert({
        user_id: userId,
        request_id: request_id,
      });

    if (voteError) throw voteError;

    // Increment upvotes
    const { error: updateError } = await supabaseAdmin
      .from("feature_requests")
      .update({ upvotes: supabaseAdmin.rpc("increment_upvotes", { id: request_id }) as any })
      .eq("id", request_id);

    // Fallback: if RPC doesn't exist, use raw query
    if (updateError) {
      const { data: current } = await supabaseAdmin
        .from("feature_requests")
        .select("upvotes")
        .eq("id", request_id)
        .single();

      await supabaseAdmin
        .from("feature_requests")
        .update({ upvotes: (current?.upvotes ?? 0) + 1 })
        .eq("id", request_id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Vote error:", err);
    return NextResponse.json({ error: "Failed to vote" }, { status: 500 });
  }
}

// DELETE /api/feature-requests/vote
// Remove upvote
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { request_id } = body as any;

  if (!request_id) {
    return NextResponse.json({ error: "request_id required" }, { status: 400 });
  }

  try {
    // Delete vote
    const { error: voteError } = await supabaseAdmin
      .from("feature_request_votes")
      .delete()
      .eq("user_id", userId)
      .eq("request_id", request_id);

    if (voteError) throw voteError;

    // Decrement upvotes
    const { data: current } = await supabaseAdmin
      .from("feature_requests")
      .select("upvotes")
      .eq("id", request_id)
      .single();

    await supabaseAdmin
      .from("feature_requests")
      .update({ upvotes: Math.max(0, (current?.upvotes ?? 0) - 1) })
      .eq("id", request_id);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Unvote error:", err);
    return NextResponse.json({ error: "Failed to remove vote" }, { status: 500 });
  }
}
