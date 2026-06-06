import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import { computeReport } from "@/lib/enterprise-reports";

export const maxDuration = 30;

// Comprehensive HR reporting endpoint. Query params: from, to, job, department
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const url = new URL(req.url);
  const data = await computeReport(org.id, {
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    job: url.searchParams.get("job"),
    department: url.searchParams.get("department"),
  });

  return NextResponse.json({ data });
}
