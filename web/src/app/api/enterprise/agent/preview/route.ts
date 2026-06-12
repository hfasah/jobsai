import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

type Condition = { field: string; operator: string; value: unknown };

function evalCond(c: Condition, app: Record<string, unknown>): boolean {
  const raw = app[c.field];
  switch (c.operator) {
    case "gte":       return typeof raw === "number" && raw >= (c.value as number);
    case "lte":       return typeof raw === "number" && raw <= (c.value as number);
    case "gt":        return typeof raw === "number" && raw > (c.value as number);
    case "lt":        return typeof raw === "number" && raw < (c.value as number);
    case "eq":        return raw === c.value;
    case "neq":       return raw !== c.value;
    case "in":        return Array.isArray(c.value) && (c.value as unknown[]).includes(raw);
    case "not_in":    return Array.isArray(c.value) && !(c.value as unknown[]).includes(raw);
    case "is_empty":  return !raw || (Array.isArray(raw) && (raw as unknown[]).length === 0);
    case "not_empty": return !!raw && !(Array.isArray(raw) && (raw as unknown[]).length === 0);
    case "contains_all": {
      const arr = Array.isArray(raw) ? (raw as string[]) : [];
      const req = Array.isArray(c.value) ? (c.value as string[]) : [];
      return req.every((v) => arr.some((a) => a.toLowerCase().includes(v.toLowerCase())));
    }
    case "contains_any": {
      const arr = Array.isArray(raw) ? (raw as string[]) : [];
      const any = Array.isArray(c.value) ? (c.value as string[]) : [];
      return any.some((v) => arr.some((a) => a.toLowerCase().includes(v.toLowerCase())));
    }
    default: return false;
  }
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const conditions: Condition[] = body.conditions ?? [];
  const jobId: string | null = body.job_id ?? null;

  if (!conditions.length) return NextResponse.json({ matches: [], total: 0 });

  let query = supabaseAdmin
    .from("enterprise_applications")
    .select("id,candidate_name,stage,match_score,ats_score,ai_recommendation,risk_flags,ats_keywords_matched,ats_keywords_missing,job_id")
    .eq("org_id", org.id)
    .not("stage", "in", '("rejected")');

  if (jobId) query = query.eq("job_id", jobId);

  const { data: apps } = await query.limit(500);
  if (!apps) return NextResponse.json({ matches: [], total: 0 });

  const matching = (apps as Record<string, unknown>[]).filter((app) =>
    conditions.every((c) => evalCond(c, app))
  );

  // Enrich with job titles for display
  const jobIds = [...new Set(matching.map((a) => a.job_id as string))];
  const { data: jobs } = await supabaseAdmin
    .from("enterprise_jobs").select("id,title").in("id", jobIds);
  const jobMap: Record<string, string> = {};
  for (const j of jobs ?? []) jobMap[j.id] = j.title;

  const result = matching.slice(0, 20).map((a) => ({
    application_id: a.id,
    candidate_name: a.candidate_name,
    stage: a.stage,
    match_score: a.match_score,
    ai_recommendation: a.ai_recommendation,
    job_title: jobMap[a.job_id as string] ?? "—",
  }));

  return NextResponse.json({ matches: result, total: matching.length });
}
