import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse, after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { requirePermission } from "@/lib/enterprise-permissions";
import { getMyOrg } from "@/lib/enterprise";
import { audit } from "@/lib/enterprise-audit";

export const maxDuration = 30;

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/enterprise/sourcing/export?runId= — CSV of a run's results.
// Contact values are included ONLY where already revealed; suppressed and
// not-relevant rows are excluded.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "global_sourcing");
  if (gate) return gate;
  const denied = await requirePermission(userId, "can_export_sourced");
  if (denied) return denied;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const runId = req.nextUrl.searchParams.get("runId");
  if (!runId) return NextResponse.json({ error: "runId is required." }, { status: 400 });

  const { data: run } = await supabaseAdmin
    .from("sourcing_search_runs")
    .select("id, query_text, created_at")
    .eq("id", runId)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });

  const { data: results } = await supabaseAdmin
    .from("sourcing_run_results")
    .select(
      `match_score, fit_reason, dedup_status, origin,
       external:sourcing_external_candidates (
         full_name, job_title, company, location_locality, location_country,
         skills, experience_years, linkedin_url, emails, phones,
         profile_unlocked, provider_key, collected_at, suppressed
       )`,
    )
    .eq("run_id", runId)
    .eq("org_id", org.id)
    .eq("not_relevant", false)
    .order("position", { ascending: true })
    .limit(1000);

  const header = [
    "name", "title", "company", "location", "experience_years", "skills",
    "match_score", "status", "email", "email_verified", "phone",
    "linkedin_url", "source_provider", "collected_at", "fit_reason",
  ];
  const lines = [header.join(",")];

  for (const r of (results ?? []) as Record<string, unknown>[]) {
    const ext = r.external as Record<string, unknown> | null;
    if (!ext || ext.suppressed) continue;
    const emails = (ext.emails as { value: string; verification_status?: string }[]) ?? [];
    const phones = (ext.phones as { value: string }[]) ?? [];
    const unlocked = ext.profile_unlocked === true;
    lines.push(
      [
        csvEscape(ext.full_name),
        csvEscape(ext.job_title),
        csvEscape(ext.company),
        csvEscape([ext.location_locality, ext.location_country].filter(Boolean).join(", ")),
        csvEscape(ext.experience_years),
        csvEscape(((ext.skills as string[]) ?? []).join("; ")),
        csvEscape(r.match_score),
        csvEscape(r.dedup_status),
        csvEscape(unlocked ? emails[0]?.value ?? "" : ""),
        csvEscape(unlocked ? emails[0]?.verification_status ?? "" : ""),
        csvEscape(unlocked ? phones[0]?.value ?? "" : ""),
        csvEscape(ext.linkedin_url),
        csvEscape(ext.provider_key),
        csvEscape(ext.collected_at),
        csvEscape(r.fit_reason),
      ].join(","),
    );
  }

  after(() => {
    audit({
      org_id: org.id,
      user_id: userId,
      action: "sourcing.results_exported",
      resource_type: "sourcing_run",
      resource_id: runId,
      metadata: { rows: lines.length - 1 },
    });
  });

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sourcing-${runId.slice(0, 8)}.csv"`,
    },
  });
}
