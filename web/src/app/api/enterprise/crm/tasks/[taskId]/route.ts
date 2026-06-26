import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { crmContext } from "@/lib/enterprise-crm";

type Ctx = { params: Promise<{ taskId: string }> };

const EDITABLE = ["title", "due_at", "reminder_at", "notes", "owner_id", "company_id", "contact_id"] as const;

// PUT — edit a task or toggle completion. Pass { status: "done" | "open" } to toggle;
// completed_at is set/cleared automatically.
export async function PUT(req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { taskId } = await params;
  const body = await req.json().catch(() => ({}));

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of EDITABLE) if (k in body) update[k] = body[k];
  if (body.status === "done" || body.status === "open") {
    update.status = body.status;
    update.completed_at = body.status === "done" ? new Date().toISOString() : null;
  }

  const { data, error } = await supabaseAdmin
    .from("crm_tasks")
    .update(update)
    .eq("id", taskId)
    .eq("org_id", ctx.org.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const ctx = await crmContext();
  if (!ctx.ok) return ctx.res;
  const { taskId } = await params;

  const { error } = await supabaseAdmin
    .from("crm_tasks").delete().eq("id", taskId).eq("org_id", ctx.org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
