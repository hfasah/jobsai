import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");

  let q = supabaseAdmin
    .from("enterprise_sourcing_outreach")
    .select("id, candidate_name, candidate_email, candidate_source, job_id, subject, replied_at, reply_added_to_pipeline, follow_up_1_sent_at, follow_up_2_sent_at, unsubscribed, created_at, job:enterprise_jobs(title)")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (jobId) q = q.eq("job_id", jobId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
