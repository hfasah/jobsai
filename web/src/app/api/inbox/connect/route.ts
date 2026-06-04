import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { googleAuthUrl, gmailConfigured } from "@/lib/gmail";

// GET /api/inbox/connect — start the Google OAuth flow.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url));
  if (!gmailConfigured()) {
    return NextResponse.redirect(new URL("/dashboard/inbox?error=not_configured", req.url));
  }
  return NextResponse.redirect(googleAuthUrl("connect"));
}
