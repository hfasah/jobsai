import { supabaseAdmin } from "@/lib/supabase";

export type PoolType = "auto_top" | "auto_strong" | "auto_possible" | "auto_low" | "custom";

export const AUTO_POOLS: { type: PoolType; name: string; description: string; color: string; min: number; order: number }[] = [
  { type: "auto_top",      name: "Top Candidates",      description: "Best matches (85-100)", color: "green",  min: 85, order: 0 },
  { type: "auto_strong",   name: "Strong Candidates",   description: "Good matches (70-84)",  color: "cyan",   min: 70, order: 1 },
  { type: "auto_possible", name: "Possible Candidates", description: "Worth a look (50-69)",  color: "amber",  min: 50, order: 2 },
  { type: "auto_low",      name: "Low Match",           description: "Weak matches (0-49)",   color: "red",    min: 0,  order: 3 },
];

export function poolTypeForScore(score: number): PoolType {
  if (score >= 85) return "auto_top";
  if (score >= 70) return "auto_strong";
  if (score >= 50) return "auto_possible";
  return "auto_low";
}

// Lazily create the 4 auto pools for a job; returns a map of type -> pool id
export async function ensureJobPools(orgId: string, jobId: string): Promise<Record<string, string>> {
  const { data: existing } = await supabaseAdmin
    .from("enterprise_pools")
    .select("id, type")
    .eq("job_id", jobId);

  const map: Record<string, string> = {};
  for (const p of existing ?? []) map[p.type] = p.id;

  const missing = AUTO_POOLS.filter((ap) => !map[ap.type]);
  if (missing.length) {
    const { data: created } = await supabaseAdmin
      .from("enterprise_pools")
      .insert(missing.map((ap) => ({
        org_id: orgId, job_id: jobId, name: ap.name, description: ap.description,
        type: ap.type, color: ap.color, sort_order: ap.order,
      })))
      .select("id, type");
    for (const p of created ?? []) map[p.type] = p.id;
  }
  return map;
}

// Assign a screened application to the right auto-pool and mark it triaged
export async function assignToPool(orgId: string, jobId: string, appId: string, score: number): Promise<void> {
  const pools = await ensureJobPools(orgId, jobId);
  const type = poolTypeForScore(score);
  const poolId = pools[type];
  if (!poolId) return;
  await supabaseAdmin
    .from("enterprise_applications")
    .update({ pool_id: poolId, triaged: true })
    .eq("id", appId);
}
