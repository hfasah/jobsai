import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext } from "@/lib/enterprise-crm";

type Ctx = { params: Promise<{ submissionId: string }> };

const EDITABLE = [
  "job_order_id", "contact_id", "candidate_name", "candidate_email", "candidate_phone",
  "resume_url", "status", "notes", "owner_id",
] as const;

export async function PUT(req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { submissionId } = await params;
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) if (k in body) update[k] = body[k] === "" ? null : body[k];
  if (typeof update.candidate_name === "string" && !update.candidate_name.trim()) {
    return NextResponse.json({ error: "Candidate name cannot be empty." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("crm_submissions")
    .update(update)
    .eq("id", submissionId)
    .eq("org_id", ctx.org.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { submissionId } = await params;

  const { error } = await supabaseAdmin.from("crm_submissions").delete().eq("id", submissionId).eq("org_id", ctx.org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
