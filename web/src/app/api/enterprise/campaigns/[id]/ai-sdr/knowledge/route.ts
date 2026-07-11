import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { guardCampaign } from "@/lib/outreach/ai-sdr-guard";

type Ctx = { params: Promise<{ id: string }> };

// POST — add a knowledge-base doc to the campaign.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const g = await guardCampaign(id);
  if (g.error) return g.error;

  const body = await req.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  const content = typeof body.content === "string" ? body.content.trim().slice(0, 20000) : "";
  if (!title || !content) return NextResponse.json({ error: "Title and content are required." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("ai_sdr_knowledge")
    .insert({
      org_id: g.org.id,
      campaign_id: id,
      title,
      content,
      pinned: body.pinned === true,
      created_by: g.userId,
    })
    .select("id, title, content, source, pinned, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE — remove a doc: /ai-sdr/knowledge?docId=…
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const g = await guardCampaign(id);
  if (g.error) return g.error;

  const docId = req.nextUrl.searchParams.get("docId");
  if (!docId) return NextResponse.json({ error: "docId is required." }, { status: 400 });

  await supabaseAdmin
    .from("ai_sdr_knowledge")
    .delete()
    .eq("id", docId)
    .eq("campaign_id", id)
    .eq("org_id", g.org.id);
  return NextResponse.json({ ok: true });
}
