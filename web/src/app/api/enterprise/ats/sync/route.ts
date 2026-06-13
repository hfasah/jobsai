import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requirePermission } from "@/lib/enterprise-permissions";
import { audit } from "@/lib/enterprise-audit";
import { listApplications, listJobs, type MergeApplication, type MergeCandidate } from "@/lib/merge";

function jobStatus(s?: string | null): string {
  switch ((s ?? "").toUpperCase()) {
    case "OPEN":
      return "active";
    case "CLOSED":
    case "ARCHIVED":
      return "closed";
    case "DRAFT":
    case "PENDING":
      return "draft";
    default:
      return "active";
  }
}

function candidateInfo(c: MergeApplication["candidate"]): { name: string; email: string } | null {
  if (!c || typeof c === "string") return null;
  const cand = c as MergeCandidate;
  const name = [cand.first_name, cand.last_name].filter(Boolean).join(" ").trim();
  const email = cand.email_addresses?.find((e) => e.value)?.value ?? "";
  if (!name && !email) return null;
  return { name: name || email, email };
}

export async function POST() {
  const { userId } = await auth();
  const denied = await requirePermission(userId, "can_manage_settings");
  if (denied) return denied;

  const org = await getMyOrg(userId!);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data: conn } = await supabaseAdmin
    .from("enterprise_ats_connections")
    .select("account_token")
    .eq("org_id", org.id)
    .eq("status", "active")
    .maybeSingle();
  if (!conn?.account_token) {
    return NextResponse.json({ error: "No active ATS connection." }, { status: 400 });
  }

  let jobsRes, appsRes;
  try {
    jobsRes = await listJobs(conn.account_token);
    appsRes = await listApplications(conn.account_token);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Sync failed." }, { status: 502 });
  }

  // merge job id -> enterprise job id
  const { data: existingJobs } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("id,ats_external_id")
    .eq("org_id", org.id)
    .not("ats_external_id", "is", null);
  const jobMap = new Map<string, string>();
  for (const j of existingJobs ?? []) if (j.ats_external_id) jobMap.set(j.ats_external_id, j.id);

  let jobsImported = 0;
  for (const j of jobsRes.results) {
    const title = j.name?.trim() || "Untitled role";
    const department = j.departments?.[0]?.name ?? null;
    const location = j.offices?.[0]?.location ?? j.offices?.[0]?.name ?? null;
    const status = jobStatus(j.status);
    const existing = jobMap.get(j.id);
    if (existing) {
      await supabaseAdmin
        .from("enterprise_jobs")
        .update({ title, department, location, status })
        .eq("id", existing);
    } else {
      const { data: ins } = await supabaseAdmin
        .from("enterprise_jobs")
        .insert({ org_id: org.id, title, department, location, status, created_by: userId!, ats_external_id: j.id })
        .select("id")
        .single();
      if (ins) {
        jobMap.set(j.id, ins.id);
        jobsImported++;
      }
    }
  }

  const { data: existingApps } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id,ats_external_id")
    .eq("org_id", org.id)
    .not("ats_external_id", "is", null);
  const appMap = new Map<string, string>();
  for (const a of existingApps ?? []) if (a.ats_external_id) appMap.set(a.ats_external_id, a.id);

  let candidatesImported = 0;
  let skipped = 0;
  for (const a of appsRes.results) {
    const info = candidateInfo(a.candidate);
    const jobId = a.job ? jobMap.get(a.job) : undefined;
    if (!info || !jobId) {
      skipped++;
      continue;
    }
    const existing = appMap.get(a.id);
    const email = info.email || `${a.id}@imported.ats`;
    if (existing) {
      await supabaseAdmin
        .from("enterprise_applications")
        .update({ candidate_name: info.name, candidate_email: email })
        .eq("id", existing);
    } else {
      const { error } = await supabaseAdmin.from("enterprise_applications").insert({
        org_id: org.id,
        job_id: jobId,
        candidate_name: info.name,
        candidate_email: email,
        source: "ats",
        ats_external_id: a.id,
      });
      if (!error) candidatesImported++;
    }
  }

  await supabaseAdmin
    .from("enterprise_ats_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("org_id", org.id);

  await audit({
    org_id: org.id,
    user_id: userId!,
    action: "ats.synced",
    resource_type: "ats_connection",
    resource_id: org.id,
    metadata: { jobsImported, candidatesImported, skipped },
  });

  return NextResponse.json({
    ok: true,
    jobs: jobsRes.results.length,
    jobsImported,
    candidatesImported,
    skipped,
  });
}
