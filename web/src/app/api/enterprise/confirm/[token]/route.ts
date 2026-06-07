import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data } = await supabaseAdmin
    .from("enterprise_interview_schedule")
    .select("title, candidate_name, scheduled_at, duration_min, meeting_link, interview_type, location, status, org_id")
    .eq("confirm_token", token).maybeSingle();
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: org } = await supabaseAdmin.from("enterprise_orgs").select("name").eq("id", data.org_id).maybeSingle();
  return NextResponse.json({ data: { ...data, org_name: org?.name ?? "the company" } });
}

// POST — candidate confirms or declines
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.decline ? "cancelled" : "confirmed";
  const { error } = await supabaseAdmin
    .from("enterprise_interview_schedule").update({ status, updated_at: new Date().toISOString() }).eq("confirm_token", token);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, status });
}
