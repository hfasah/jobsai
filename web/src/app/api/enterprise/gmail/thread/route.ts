import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import { getCandidateEmailThread } from "@/lib/recruiter-gmail";

// GET /api/enterprise/gmail/thread?email=candidate@example.com
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const email = req.nextUrl.searchParams.get("email");
  if (!email) return NextResponse.json({ error: "email param required." }, { status: 400 });

  const threads = await getCandidateEmailThread(userId, email);
  return NextResponse.json({ data: threads });
}
