import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// GET /api/inbox/unread-count — lightweight count for the nav badge (no message
// bodies fetched, unlike GET /api/inbox).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ unread: 0 });

  const { count } = await supabaseAdmin
    .from("inbox_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("direction", "inbound")
    .eq("is_read", false);

  return NextResponse.json({ unread: count ?? 0 });
}
