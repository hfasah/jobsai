import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/notifications — last 30 notifications + unread count
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [listRes, countRes] = await Promise.all([
    supabaseAdmin
      .from("user_notifications")
      .select("id, type, title, body, metadata, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabaseAdmin
      .from("user_notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null),
  ]);

  return NextResponse.json({
    data: listRes.data ?? [],
    unread_count: countRes.count ?? 0,
  });
}
