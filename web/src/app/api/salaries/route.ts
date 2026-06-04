import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getSalaryComparison } from "@/lib/salaries";

// GET /api/salaries?title=Software Engineer
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await getSalaryComparison(req.nextUrl.searchParams.get("title") ?? "");
    return NextResponse.json({ data });
  } catch (err) {
    console.error("salaries error:", err);
    return NextResponse.json({ error: "Could not load salary data." }, { status: 502 });
  }
}
