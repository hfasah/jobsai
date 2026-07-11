import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { guardCampaign } from "@/lib/outreach/ai-sdr-guard";

type Ctx = { params: Promise<{ id: string }> };

const CONFIG_COLS =
  "ai_sdr_enabled, ai_sdr_mode, ai_sdr_persona, ai_sdr_guardrails, ai_sdr_min_confidence, ai_sdr_max_replies, ai_sdr_tier";

// GET — AI SDR config + knowledge base + memory for the campaign editor panel.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const g = await guardCampaign(id);
  if (g.error) return g.error;

  const [{ data: config }, { data: knowledge }, { data: memory }] = await Promise.all([
    supabaseAdmin.from("enterprise_campaigns").select(CONFIG_COLS).eq("id", id).eq("org_id", g.org.id).maybeSingle(),
    supabaseAdmin
      .from("ai_sdr_knowledge")
      .select("id, title, content, source, pinned, updated_at")
      .eq("org_id", g.org.id).eq("campaign_id", id)
      .order("pinned", { ascending: false }).order("updated_at", { ascending: false }),
    supabaseAdmin
      .from("ai_sdr_memory")
      .select("id, kind, content, created_at")
      .eq("org_id", g.org.id).eq("campaign_id", id)
      .order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({ data: { config, knowledge: knowledge ?? [], memory: memory ?? [] } });
}

// PATCH — update AI SDR config columns.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const g = await guardCampaign(id);
  if (g.error) return g.error;

  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.ai_sdr_enabled === "boolean") update.ai_sdr_enabled = body.ai_sdr_enabled;
  if (body.ai_sdr_mode === "draft" || body.ai_sdr_mode === "auto") update.ai_sdr_mode = body.ai_sdr_mode;
  if (typeof body.ai_sdr_persona === "string") update.ai_sdr_persona = body.ai_sdr_persona.trim().slice(0, 4000) || null;
  if (typeof body.ai_sdr_guardrails === "string") update.ai_sdr_guardrails = body.ai_sdr_guardrails.trim().slice(0, 4000) || null;
  if (typeof body.ai_sdr_min_confidence === "number") {
    update.ai_sdr_min_confidence = Math.max(0, Math.min(1, body.ai_sdr_min_confidence));
  }
  if (typeof body.ai_sdr_max_replies === "number") {
    update.ai_sdr_max_replies = Math.max(0, Math.min(10, Math.round(body.ai_sdr_max_replies)));
  }
  if (body.ai_sdr_tier === "smart" || body.ai_sdr_tier === "fast") update.ai_sdr_tier = body.ai_sdr_tier;

  if (Object.keys(update).length === 1) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  await supabaseAdmin.from("enterprise_campaigns").update(update).eq("id", id).eq("org_id", g.org.id);
  return NextResponse.json({ ok: true });
}
