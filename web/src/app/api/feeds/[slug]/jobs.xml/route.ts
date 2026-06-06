import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

// Universal aggregator XML job feed. This single URL is registered once with
// Indeed, ZipRecruiter, Jooble, Adzuna, Talroo, Jobg8, etc. — every active job
// then syndicates automatically. Standard <source><job> schema.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs").select("id, name, website").eq("slug", slug).maybeSingle();
  if (!org) return new NextResponse("Not found", { status: 404 });

  const { data: jobs } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("id, title, department, location, employment_type, description, responsibilities, qualifications, nice_to_have, salary_min, salary_max, salary_currency, published_at, created_at")
    .eq("org_id", org.id).eq("status", "active")
    .order("published_at", { ascending: false });

  const cdata = (s: string | null | undefined) => `<![CDATA[${(s ?? "").replace(/]]>/g, "]]&gt;")}]]>`;
  const jobTypeMap: Record<string, string> = { "full-time": "fulltime", "part-time": "parttime", contract: "contract", internship: "internship" };

  const items = (jobs ?? []).map((j) => {
    const applyUrl = `${APP_URL}/enterprise/jobs/${j.id}/apply`;
    const descHtml = [
      j.description, j.responsibilities ? `<h3>Responsibilities</h3>${j.responsibilities.replace(/\n/g, "<br>")}` : "",
      j.qualifications ? `<h3>Requirements</h3>${j.qualifications.replace(/\n/g, "<br>")}` : "",
      j.nice_to_have ? `<h3>Nice to have</h3>${j.nice_to_have.replace(/\n/g, "<br>")}` : "",
    ].filter(Boolean).join("");
    const salary = j.salary_min && j.salary_max ? `${j.salary_min}-${j.salary_max} ${j.salary_currency}/year` : "";
    // location field like "Toronto, ON · Remote" — first comma-part = city
    const loc = (j.location ?? "").split("·")[0].trim();
    const city = loc.split(",")[0]?.trim() ?? "";
    const state = loc.split(",")[1]?.trim() ?? "";

    return `  <job>
    <title>${cdata(j.title)}</title>
    <date>${cdata(new Date(j.published_at ?? j.created_at).toUTCString())}</date>
    <referencenumber>${cdata(j.id)}</referencenumber>
    <url>${cdata(applyUrl)}</url>
    <company>${cdata(org.name)}</company>
    <city>${cdata(city)}</city>
    <state>${cdata(state)}</state>
    <country>${cdata("")}</country>
    <description>${cdata(descHtml)}</description>
    <salary>${cdata(salary)}</salary>
    <jobtype>${cdata(jobTypeMap[j.employment_type] ?? "fulltime")}</jobtype>
    <category>${cdata(j.department ?? "")}</category>
    <remote>${cdata((j.location ?? "").toLowerCase().includes("remote") ? "Yes" : "No")}</remote>
  </job>`;
  }).join("\n");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<source>
  <publisher>${cdata(org.name)}</publisher>
  <publisherurl>${cdata(org.website ?? APP_URL)}</publisherurl>
  <lastBuildDate>${cdata(new Date().toUTCString())}</lastBuildDate>
${items}
</source>`;

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" },
  });
}
