import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const [activityRes, statsRes] = await Promise.all([
    supabaseAdmin
      .from("enterprise_agent_actions")
      .select("id,rule_name,candidate_name,job_title,action,result,details,created_at")
      .eq("org_id", org.id)
      .order("created_at", { ascending: false })
      .limit(50),

    supabaseAdmin
      .from("enterprise_agent_actions")
      .select("action,result", { count: "exact" })
      .eq("org_id", org.id)
      .eq("result", "success")
      .gte("created_at", new Date(Date.now() - 7 * 86_400_000).toISOString()),
  ]);

  return NextResponse.json({
    activity: activityRes.data ?? [],
    total_this_week: statsRes.count ?? 0,
  });
}
