import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { syncInbox } from "@/lib/gmail";

// POST /api/inbox/sync — pull recent job-related replies from Gmail.
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await syncInbox(userId);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("inbox sync error:", err);
    return NextResponse.json({ error: "Sync failed. Reconnect your mailbox and try again." }, { status: 502 });
  }
}
