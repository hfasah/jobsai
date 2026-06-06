import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";

export const maxDuration = 30;

// Sync jobs FROM an ATS into enterprise_jobs
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { provider } = await req.json().catch(() => ({}));
  if (!provider) return NextResponse.json({ error: "provider required." }, { status: 400 });

  const { data: integration } = await supabaseAdmin
    .from("enterprise_integrations")
    .select("*")
    .eq("org_id", org.id)
    .eq("provider", provider)
    .eq("enabled", true)
    .maybeSingle();

  if (!integration) return NextResponse.json({ error: "Integration not found or disabled." }, { status: 404 });

  let jobs: Array<{ title: string; location?: string; department?: string; employment_type?: string; external_id?: string }> = [];

  try {
    if (provider === "greenhouse") {
      const res = await fetch(`https://harvest.greenhouse.io/v1/jobs?status=open`, {
        headers: { "Authorization": `Basic ${Buffer.from(integration.api_key + ":").toString("base64")}` },
      });
      if (!res.ok) return NextResponse.json({ error: "Greenhouse API error: " + res.statusText }, { status: 502 });
      const data = await res.json();
      jobs = (Array.isArray(data) ? data : []).slice(0, 50).map((j: Record<string, unknown>) => ({
        title: j.name as string,
        location: (j.offices as Array<{ name: string }>)?.[0]?.name ?? null,
        department: (j.departments as Array<{ name: string }>)?.[0]?.name ?? null,
        employment_type: "full-time",
        external_id: String(j.id),
      }));

    } else if (provider === "lever") {
      const res = await fetch(`https://api.lever.co/v1/postings?state=published&limit=50`, {
        headers: { "Authorization": `Basic ${Buffer.from(integration.api_key + ":").toString("base64")}` },
      });
      if (!res.ok) return NextResponse.json({ error: "Lever API error: " + res.statusText }, { status: 502 });
      const data = await res.json();
      jobs = ((data.data as Array<Record<string, unknown>>) ?? []).map((p) => ({
        title: p.text as string,
        location: (p.categories as Record<string, unknown>)?.location as string ?? null,
        department: (p.categories as Record<string, unknown>)?.department as string ?? null,
        employment_type: (p.categories as Record<string, unknown>)?.commitment as string ?? "full-time",
        external_id: p.id as string,
      }));

    } else if (provider === "ashby") {
      const res = await fetch("https://api.ashbyhq.com/jobPosting.list", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Basic ${Buffer.from(integration.api_key + ":").toString("base64")}` },
        body: JSON.stringify({ includeUnlisted: false }),
      });
      if (!res.ok) return NextResponse.json({ error: "Ashby API error: " + res.statusText }, { status: 502 });
      const data = await res.json();
      jobs = ((data.results as Array<Record<string, unknown>>) ?? []).slice(0, 50).map((p) => ({
        title: p.title as string,
        location: (p.jobLocation as Record<string, unknown>)?.name as string ?? null,
        department: (p.department as Record<string, unknown>)?.name as string ?? null,
        employment_type: "full-time",
        external_id: p.id as string,
      }));

    } else if (provider === "bamboohr") {
      const subdomain = integration.subdomain ?? "company";
      const res = await fetch(`https://api.bamboohr.com/api/gateway.php/${subdomain}/v1/applicant_tracking/jobs`, {
        headers: {
          "Authorization": `Basic ${Buffer.from(integration.api_key + ":x").toString("base64")}`,
          "Accept": "application/json",
        },
      });
      if (!res.ok) return NextResponse.json({ error: "BambooHR API error: " + res.statusText }, { status: 502 });
      const data = await res.json();
      jobs = ((data as Array<Record<string, unknown>>) ?? []).slice(0, 50).map((j) => ({
        title: j.jobTitle as string,
        department: j.department as string ?? null,
        location: j.location as string ?? null,
        employment_type: j.employmentType as string ?? "full-time",
        external_id: String(j.id),
      }));

    } else {
      return NextResponse.json({ error: `Provider "${provider}" not yet supported.` }, { status: 400 });
    }
  } catch (err) {
    console.error("ATS sync error:", err);
    return NextResponse.json({ error: "Failed to reach ATS API. Check your credentials." }, { status: 502 });
  }

  // Upsert jobs into enterprise_jobs
  let imported = 0;
  for (const job of jobs) {
    const { error } = await supabaseAdmin.from("enterprise_jobs").insert({
      org_id: org.id,
      title: job.title,
      location: job.location ?? null,
      department: job.department ?? null,
      employment_type: job.employment_type ?? "full-time",
      status: "active",
      created_by: userId,
      published_at: new Date().toISOString(),
    });
    if (!error) imported++;
  }

  await supabaseAdmin.from("enterprise_integrations").update({ last_sync: new Date().toISOString() }).eq("id", integration.id);
  await audit({ org_id: org.id, user_id: userId, action: "integration.synced", metadata: { provider, imported } });

  return NextResponse.json({ ok: true, imported, total: jobs.length });
}
