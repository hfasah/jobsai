import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

// GET /api/enterprise/inbox — every application across all the org's jobs,
// joined with the job title, newest first. The client auto-triages into pools.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const url = new URL(req.url);
  const jobFilter = url.searchParams.get("job");

  // Inbox = untriaged arrivals only. Once screened, candidates move into a pool
  // and leave the inbox. ?all=1 returns everything (used by some views).
  const showAll = url.searchParams.get("all") === "1";

  let query = supabaseAdmin
    .from("enterprise_applications")
    .select("*, job:enterprise_jobs(id, title, department)")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!showAll) query = query.eq("triaged", false);
  if (jobFilter) query = query.eq("job_id", jobFilter);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // List of jobs for the filter dropdown
  const { data: jobs } = await supabaseAdmin
    .from("enterprise_jobs")
    .select("id, title")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ data: data ?? [], jobs: jobs ?? [] });
}
