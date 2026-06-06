import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

type Ctx = { params: Promise<{ appId: string }> };

// GET — onboarding hub + references + background checks for a candidate
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { appId } = await params;

  const { data: app } = await supabaseAdmin
    .from("enterprise_applications").select("id, job_id, candidate_name, stage").eq("id", appId).eq("org_id", org.id).maybeSingle();
  if (!app) return NextResponse.json({ error: "Candidate not found." }, { status: 404 });

  // Lazily create the onboarding record
  let { data: onboarding } = await supabaseAdmin
    .from("enterprise_onboarding").select("*").eq("application_id", appId).maybeSingle();
  if (!onboarding) {
    const { data } = await supabaseAdmin
      .from("enterprise_onboarding")
      .insert({ application_id: appId, org_id: org.id, job_id: app.job_id, status: "not_started", offer_accepted_at: new Date().toISOString() })
      .select("*").single();
    onboarding = data;
  }

  const [{ data: references }, { data: checks }] = await Promise.all([
    supabaseAdmin.from("enterprise_references").select("*").eq("application_id", appId).order("created_at"),
    supabaseAdmin.from("enterprise_background_checks").select("*").eq("application_id", appId).order("created_at"),
  ]);

  return NextResponse.json({ data: { onboarding, references: references ?? [], checks: checks ?? [] } });
}

// PUT — update onboarding (start_date, status, notes)
export async function PUT(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { appId } = await params;
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const f of ["start_date", "status", "notes"]) if (body[f] !== undefined) update[f] = body[f];

  const { data, error } = await supabaseAdmin
    .from("enterprise_onboarding").update(update).eq("application_id", appId).eq("org_id", org.id)
    .select("*").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
