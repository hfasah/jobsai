import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export interface PendingApprovalItem {
  id: string;
  job_id: string;
  match_score: number;
  created_at: string;
  title: string | null;
  company: string | null;
  location: string | null;
  employment_type: string | null;
  skills: string[];
  source_url: string | null;
}

// GET /api/approvals — list all pending approval items with job details
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rows } = await supabaseAdmin
    .from("pending_approvals")
    .select("id, job_id, match_score, created_at")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("match_score", { ascending: false });

  if (!rows || rows.length === 0) {
    return NextResponse.json({ data: [], count: 0 });
  }

  const jobIds = rows.map((r) => r.job_id);

  const [jobsRes, parsedRes] = await Promise.all([
    supabaseAdmin
      .from("jobs")
      .select("id, source_url")
      .in("id", jobIds),
    supabaseAdmin
      .from("job_parsed")
      .select("job_id, title, company, location, employment_type, skills")
      .in("job_id", jobIds),
  ]);

  const jobMap = Object.fromEntries((jobsRes.data ?? []).map((j) => [j.id, j]));
  const parsedMap = Object.fromEntries((parsedRes.data ?? []).map((p) => [p.job_id, p]));

  const items: PendingApprovalItem[] = rows.map((row) => {
    const job    = jobMap[row.job_id];
    const parsed = parsedMap[row.job_id];
    return {
      id:              row.id,
      job_id:          row.job_id,
      match_score:     row.match_score,
      created_at:      row.created_at,
      title:           parsed?.title        ?? null,
      company:         parsed?.company      ?? null,
      location:        parsed?.location     ?? null,
      employment_type: parsed?.employment_type ?? null,
      skills:          (parsed?.skills as string[]) ?? [],
      source_url:      job?.source_url      ?? null,
    };
  });

  return NextResponse.json({ data: items, count: items.length });
}
