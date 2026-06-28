import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getMyOrg } from "@/lib/enterprise";
import { supabaseAdmin } from "@/lib/supabase";

// GET /api/enterprise/candidates?q=&stage= — every applicant across all jobs in
// the org (the global Applicants database). q does a quick name/email filter;
// skill / natural-language search goes through /candidates/search (AI).
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const stage = req.nextUrl.searchParams.get("stage");

  let query = supabaseAdmin
    .from("enterprise_applications")
    .select("id,candidate_name,candidate_email,candidate_phone,stage,ats_score,match_score,tags,resume_storage_key,resume_url,ai_summary,source,created_at,job:enterprise_jobs(id,title)")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(300);

  if (q) query = query.or(`candidate_name.ilike.%${q}%,candidate_email.ilike.%${q}%`);
  if (stage && stage !== "all") query = query.eq("stage", stage);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
