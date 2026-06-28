import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { resend } from "@/lib/resend";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  // Optional ?group_id=<id> to filter to one named pool ("none" = ungrouped).
  const group = req.nextUrl.searchParams.get("group_id");
  let query = supabaseAdmin
    .from("enterprise_talent_pool")
    .select("*")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });
  if (group === "none") query = query.is("group_id", null);
  else if (group) query = query.eq("group_id", group);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// Add a candidate to the talent pool
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Can pass an application_id to auto-fill from an existing application
  if (body.application_id) {
    const { data: app } = await supabaseAdmin
      .from("enterprise_applications")
      .select("*, job:enterprise_jobs(title)")
      .eq("id", body.application_id)
      .eq("org_id", org.id)
      .maybeSingle();

    if (!app) return NextResponse.json({ error: "Application not found." }, { status: 404 });

    const { data, error } = await supabaseAdmin
      .from("enterprise_talent_pool")
      .upsert({
        org_id: org.id,
        application_id: app.id,
        candidate_name: app.candidate_name,
        candidate_email: app.candidate_email,
        candidate_phone: app.candidate_phone,
        linkedin_url: app.linkedin_url,
        match_score: app.match_score,
        source_job_title: (app.job as { title: string } | null)?.title ?? null,
        notes: body.notes ?? null,
        skills_tags: body.skills_tags ?? [],
        group_id: body.group_id ?? null,
      }, { onConflict: "org_id,candidate_email" })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data }, { status: 201 });
  }

  // Manual add
  if (!body.candidate_name || !body.candidate_email) {
    return NextResponse.json({ error: "Name and email required." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("enterprise_talent_pool")
    .upsert({
      org_id: org.id,
      candidate_name: body.candidate_name,
      candidate_email: body.candidate_email,
      candidate_phone: body.candidate_phone ?? null,
      linkedin_url: body.linkedin_url ?? null,
      notes: body.notes ?? null,
      skills_tags: body.skills_tags ?? [],
      group_id: body.group_id ?? null,
    }, { onConflict: "org_id,candidate_email" })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
