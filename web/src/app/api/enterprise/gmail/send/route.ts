import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import { sendFromRecruiterGmail } from "@/lib/recruiter-gmail";

// POST — send an email to a candidate from the recruiter's connected Gmail
// body: { to, subject, html, fromName?, appId? }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { to, subject, html, fromName } = body;
  if (!to || !subject || !html) {
    return NextResponse.json({ error: "to, subject, and html are required." }, { status: 400 });
  }

  const result = await sendFromRecruiterGmail(userId, { to, subject, html, fromName });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Send failed." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
