import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { searchJobs, type SortKey, type EmploymentType } from "@/lib/job-search";
import { supabaseAdmin } from "@/lib/supabase";
import { isBlockedJob } from "@/lib/blocklist";

const EMP_VALUES: EmploymentType[] = ["fulltime", "internship", "contract", "hybrid"];

// GET /api/job-search?what=&where=&country=&page=&sort=&salary_min=&remote=&employment_types=&job_sites=
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const sort = (sp.get("sort") as SortKey) || "relevance";
  const csv = (key: string) => (sp.get(key)?.split(",").map((s) => s.trim()).filter(Boolean) ?? []);

  try {
    const countries = csv("countries");
    const result = await searchJobs({
      what: sp.get("what")?.trim() ?? "",
      where: sp.get("where")?.trim() || undefined,
      country: countries[0] || sp.get("country") || "us",
      countries: countries.length ? countries : undefined,
      page: Number(sp.get("page")) || 1,
      sort: ["relevance", "date", "salary"].includes(sort) ? sort : "relevance",
      salaryMin: Number(sp.get("salary_min")) || undefined,
      remote: sp.get("remote") === "1",
      employmentTypes: csv("employment_types").filter((e): e is EmploymentType => EMP_VALUES.includes(e as EmploymentType)),
      jobSites: csv("job_sites"),
      maxDaysOld: Number(sp.get("max_days_old")) || undefined,
    });

    // Flag results that are on the user's block list (don't drop — show them marked).
    const { data: prefs } = await supabaseAdmin
      .from("user_preferences")
      .select("excluded_companies, blocked_domains")
      .eq("user_id", userId)
      .maybeSingle();
    const excluded = prefs?.excluded_companies ?? [];
    const blockedDomains = prefs?.blocked_domains ?? [];
    if (excluded.length || blockedDomains.length) {
      result.jobs = result.jobs.map((j) => ({ ...j, blocked: isBlockedJob(j.company, j.url, excluded, blockedDomains) }));
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("job-search error:", err);
    return NextResponse.json({ error: "Search failed. Try again." }, { status: 502 });
  }
}
