import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/inbox — connection status + messages.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: acct } = await supabaseAdmin
    .from("email_accounts")
    .select("email, last_synced_at")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: messages } = await supabaseAdmin
    .from("inbox_messages")
    .select("*")
    .eq("user_id", userId)
    .order("received_at", { ascending: false })
    .limit(200);

  const unread = (messages ?? []).filter((m) => !m.is_read && m.direction === "inbound").length;

  // The platform collects employer replies via per-application aliases, so the
  // inbox is active even without a connected Gmail account — show it once any
  // reply has landed (or a mailbox is connected).
  return NextResponse.json({
    data: {
      connected: !!acct || (messages?.length ?? 0) > 0,
      email: acct?.email ?? null,
      lastSynced: acct?.last_synced_at ?? null,
      messages: messages ?? [],
      unread,
    },
  });
}
