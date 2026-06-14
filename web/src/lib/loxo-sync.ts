import { supabaseAdmin } from "@/lib/supabase";
import { listLoxoJobs, listLoxoJobCandidates } from "@/lib/loxo";

function jobStatus(s: string): string {
  const v = s.toLowerCase();
  if (v.includes("publish") || v.includes("open") || v.includes("active")) return "active";
  if (v.includes("clos") || v.includes("fill") || v.includes("archiv")) return "closed";
  if (v.includes("draft") || v.includes("pending")) return "draft";
  return "active";
}

// Pull Loxo jobs + their candidates into enterprise_jobs / enterprise_applications,
// upserting on ats_external_id (mirrors the Merge sync). Jobs are authoritative;
// candidates are best-effort per job.
export async function syncLoxo(
  orgId: string, agency: string, apiKey: string, userId: string,
): Promise<{ jobs: number; jobsImported: number; candidatesImported: number; skipped: number }> {
  const jobs = await listLoxoJobs(agency, apiKey);

  const { data: existingJobs } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("id,ats_external_id")
    .eq("org_id", orgId)
    .not("ats_external_id", "is", null);
  const jobMap = new Map<string, string>();
  for (const j of existingJobs ?? []) if (j.ats_external_id) jobMap.set(j.ats_external_id, j.id);

  let jobsImported = 0;
  for (const j of jobs) {
    const status = jobStatus(j.status);
    const existing = jobMap.get(j.id);
    if (existing) {
      await supabaseAdmin.from("enterprise_jobs").update({ title: j.title, status }).eq("id", existing);
    } else {
      const { data: ins } = await supabaseAdmin
        .from("enterprise_jobs")
        .insert({ org_id: orgId, title: j.title, status, created_by: userId, ats_external_id: j.id })
        .select("id")
        .single();
      if (ins) { jobMap.set(j.id, ins.id); jobsImported++; }
    }
  }

  const { data: existingApps } = await supabaseAdmin
    .from("enterprise_applications")
    .select("id,ats_external_id")
    .eq("org_id", orgId)
    .not("ats_external_id", "is", null);
  const appMap = new Map<string, string>();
  for (const a of existingApps ?? []) if (a.ats_external_id) appMap.set(a.ats_external_id, a.id);

  let candidatesImported = 0;
  let skipped = 0;
  for (const j of jobs) {
    const jobId = jobMap.get(j.id);
    if (!jobId) { skipped++; continue; }
    const cands = await listLoxoJobCandidates(agency, apiKey, j.id);
    for (const c of cands) {
      // Namespace the external id so the same person on two jobs = two pipeline rows.
      const extId = `${j.id}:${c.externalId}`;
      const email = c.email || `${c.externalId}@imported.loxo`;
      const existing = appMap.get(extId);
      if (existing) {
        await supabaseAdmin
          .from("enterprise_applications")
          .update({ candidate_name: c.name, candidate_email: email })
          .eq("id", existing);
      } else {
        const { error } = await supabaseAdmin.from("enterprise_applications").insert({
          org_id: orgId,
          job_id: jobId,
          candidate_name: c.name,
          candidate_email: email,
          source: "ats",
          ats_external_id: extId,
        });
        if (!error) { appMap.set(extId, "x"); candidatesImported++; }
      }
    }
  }

  return { jobs: jobs.length, jobsImported, candidatesImported, skipped };
}
