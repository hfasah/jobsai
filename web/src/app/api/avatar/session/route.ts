import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createStreamingSession, PERSONAS, type AvatarPersona } from "@/lib/avatar";

// GET /api/avatar/session?persona=... — tells the client whether to use a real
// streaming avatar (provider configured) or simulated mode, plus any session
// token. The persona selects which avatar to render.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const raw = req.nextUrl.searchParams.get("persona");
  const persona = raw && raw in PERSONAS ? (raw as AvatarPersona) : undefined;

  const session = await createStreamingSession(persona);
  return NextResponse.json({ data: session });
}
