import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from("enterprise_interview_feedback")
    .select("id, submitted_by, overall_rating, hire_rec, technical_rating, communication_rating, culture_rating, notes, created_at")
    .eq("interview_id", id)
    .eq("org_id", org.id)
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  // Verify interview belongs to org
  const { data: interview } = await supabaseAdmin
    .from("enterprise_interview_schedule")
    .select("id, application_id")
    .eq("id", id)
    .eq("org_id", org.id)
    .maybeSingle();

  if (!interview) return NextResponse.json({ error: "Interview not found." }, { status: 404 });

  const b = await req.json().catch(() => ({}));

  const { data, error } = await supabaseAdmin
    .from("enterprise_interview_feedback")
    .upsert({
      org_id: org.id,
      interview_id: id,
      application_id: interview.application_id ?? null,
      submitted_by: userId,
      overall_rating: b.overall_rating ?? null,
      hire_rec: b.hire_rec ?? null,
      technical_rating: b.technical_rating ?? null,
      communication_rating: b.communication_rating ?? null,
      culture_rating: b.culture_rating ?? null,
      notes: b.notes ?? null,
      private_notes: b.private_notes ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "interview_id,submitted_by" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark interview as completed if hire_rec was submitted
  if (b.hire_rec) {
    await supabaseAdmin
      .from("enterprise_interview_schedule")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("org_id", org.id)
      .in("status", ["scheduled", "confirmed"]);
  }

  return NextResponse.json({ data }, { status: 201 });
}
