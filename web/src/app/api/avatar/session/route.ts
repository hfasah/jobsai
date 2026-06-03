import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createStreamingSession } from "@/lib/avatar";

// GET /api/avatar/session — tells the client whether to use a real streaming
// avatar (provider configured) or simulated mode, plus any session token.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const session = await createStreamingSession();
  return NextResponse.json({ data: session });
}
