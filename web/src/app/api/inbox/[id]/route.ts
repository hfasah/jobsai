import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// DELETE /api/inbox/[id] — remove a message from the JobsAI inbox (not Gmail).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await supabaseAdmin.from("inbox_messages").delete().eq("id", id).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
