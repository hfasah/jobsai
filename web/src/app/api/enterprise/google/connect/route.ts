import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { googleEnterpriseAuthUrl, googleEnterpriseConfigured } from "@/lib/google-calendar-enterprise";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/enterprise-login", req.url));
  if (!googleEnterpriseConfigured()) {
    return NextResponse.redirect(new URL("/enterprise/settings?error=google_not_configured", req.url));
  }
  return NextResponse.redirect(googleEnterpriseAuthUrl(userId));
}
