import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { microsoftAuthUrl, microsoftConfigured } from "@/lib/microsoft";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/enterprise-login", req.url));
  if (!microsoftConfigured()) {
    return NextResponse.redirect(new URL("/enterprise/settings?error=microsoft_not_configured", req.url));
  }
  // state = userId so callback can associate the tokens with the right user
  return NextResponse.redirect(microsoftAuthUrl(userId));
}
