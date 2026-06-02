import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import type { ApplicationStage, StageHistoryEntry } from "@/types/application";
import { APPLICATION_STAGES } from "@/types/application";

// PATCH /api/applications/[id] — update stage / notes / next action / ordering
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  // Load current row so we can validate ownership and append stage history
  const { data: current } = await supabaseAdmin
    .from("applications")
    .select("stage, applied_at, stage_history")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update: Record<string, unknown> = {};

  if (typeof body.stage === "string") {
    const stage = body.stage as ApplicationStage;
    if (!APPLICATION_STAGES.includes(stage)) {
      return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
    }
    if (stage !== current.stage) {
      update.stage = stage;
      const now = new Date().toISOString();
      const history = (current.stage_history as StageHistoryEntry[]) ?? [];
      update.stage_history = [...history, { stage, at: now }];
      // First time moving out of "saved" stamps the applied date
      if (stage !== "saved" && !current.applied_at) update.applied_at = now;
    }
  }

  if ("notes" in body) update.notes = body.notes ?? null;
  if ("next_action" in body) update.next_action = body.next_action ?? null;
  if ("next_action_date" in body) update.next_action_date = body.next_action_date ?? null;
  if (typeof body.position === "number") update.position = body.position;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("applications")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE /api/applications/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { error } = await supabaseAdmin
    .from("applications")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
