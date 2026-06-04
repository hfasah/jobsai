import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { searchJobs, type SortKey } from "@/lib/job-search";

// GET /api/job-search?what=&where=&country=&page=&sort=&salary_min=&full_time=&contract=&remote=
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const sort = (sp.get("sort") as SortKey) || "relevance";

  try {
    const result = await searchJobs({
      what: sp.get("what")?.trim() ?? "",
      where: sp.get("where")?.trim() || undefined,
      country: sp.get("country") || "us",
      page: Number(sp.get("page")) || 1,
      sort: ["relevance", "date", "salary"].includes(sort) ? sort : "relevance",
      salaryMin: Number(sp.get("salary_min")) || undefined,
      fullTime: sp.get("full_time") === "1",
      contract: sp.get("contract") === "1",
      remote: sp.get("remote") === "1",
      maxDaysOld: Number(sp.get("max_days_old")) || undefined,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("job-search error:", err);
    return NextResponse.json({ error: "Search failed. Try again." }, { status: 502 });
  }
}
