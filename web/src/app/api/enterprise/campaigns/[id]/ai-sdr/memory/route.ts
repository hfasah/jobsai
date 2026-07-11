import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { guardCampaign } from "@/lib/outreach/ai-sdr-guard";

type Ctx = { params: Promise<{ id: string }> };
const KINDS = ["note", "objection", "fact"];

// POST — add an operator memory note (steering rule) to the campaign.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const g = await guardCampaign(id);
  if (g.error) return g.error;

  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim().slice(0, 2000) : "";
  const kind = KINDS.includes(body.kind) ? body.kind : "note";
  if (!content) return NextResponse.json({ error: "Content is required." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("ai_sdr_memory")
    .insert({ org_id: g.org.id, campaign_id: id, kind, content, created_by: g.userId })
    .select("id, kind, content, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE — remove a note: /ai-sdr/memory?noteId=…
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const g = await guardCampaign(id);
  if (g.error) return g.error;

  const noteId = req.nextUrl.searchParams.get("noteId");
  if (!noteId) return NextResponse.json({ error: "noteId is required." }, { status: 400 });

  await supabaseAdmin
    .from("ai_sdr_memory")
    .delete()
    .eq("id", noteId)
    .eq("campaign_id", id)
    .eq("org_id", g.org.id);
  return NextResponse.json({ ok: true });
}
