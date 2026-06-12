import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("enterprise_pipeline_rules")
    .select("*, job:enterprise_jobs(id,title)")
    .eq("org_id", org.id)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { name, description, trigger_event, conditions, action, action_config, job_id, active } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!conditions?.length) return NextResponse.json({ error: "At least one condition is required." }, { status: 400 });
  if (!action) return NextResponse.json({ error: "Action is required." }, { status: 400 });

  const VALID_ACTIONS = ["move_stage", "auto_reject", "add_tag", "notify_hm", "send_interview_invite"];
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("enterprise_pipeline_rules")
    .insert({
      org_id: org.id,
      job_id: job_id || null,
      name: name.trim(),
      description: description?.trim() || null,
      trigger_event: trigger_event ?? "application_screened",
      conditions,
      action,
      action_config: action_config ?? {},
      active: active !== false,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
