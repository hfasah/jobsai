import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// POST /api/inbox/[id]/read — mark a message read.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await supabaseAdmin.from("inbox_messages").update({ is_read: true }).eq("id", id).eq("user_id", userId);
  return NextResponse.json({ ok: true });
}
