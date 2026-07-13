import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY } from "@/lib/campaigns";

type Ctx = { params: Promise<{ id: string }> };

// POST — clone a campaign into a new draft. Copies settings, the sequence, the
// send window, and the AI SDR config + knowledge base. Leads are NOT copied
// (re-build the audience) unless { copy: { leads: true } } is passed.
export async function POST(req: NextRequest, { params }: Ctx) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });
  const { id } = await params;

  const copyLeads = (await req.json().catch(() => ({})))?.copy?.leads === true;

  const { data: src } = await supabaseAdmin
    .from("enterprise_campaigns")
    .select("name, description, objective, send_window_start, send_window_end, send_timezone, business_days_only, ai_sdr_enabled, ai_sdr_mode, ai_sdr_persona, ai_sdr_guardrails, ai_sdr_min_confidence, ai_sdr_max_replies, ai_sdr_tier")
    .eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!src) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const s = src as Record<string, unknown>;

  const { data: created, error } = await supabaseAdmin
    .from("enterprise_campaigns")
    .insert({ ...s, name: `Copy of ${s.name}`, status: "draft", created_by: userId })
    .select("id").single();
  if (error || !created) return NextResponse.json({ error: error?.message ?? "Could not duplicate." }, { status: 500 });
  const newId = (created as { id: string }).id;

  // Sequence steps.
  const { data: steps } = await supabaseAdmin
    .from("enterprise_campaign_steps")
    .select("step_order, delay_days, subject, body, ai_personalize, ai_prompt, ab_subject, ab_body, skip_if_in_pipeline")
    .eq("campaign_id", id).order("step_order", { ascending: true });
  if (steps && steps.length) {
    await supabaseAdmin.from("enterprise_campaign_steps").insert(steps.map((st) => ({ ...st, campaign_id: newId })));
  }

  // AI SDR knowledge base + memory.
  const [{ data: kb }, { data: mem }] = await Promise.all([
    supabaseAdmin.from("ai_sdr_knowledge").select("title, content, source, pinned").eq("campaign_id", id).eq("org_id", org.id),
    supabaseAdmin.from("ai_sdr_memory").select("kind, content").eq("campaign_id", id).eq("org_id", org.id),
  ]);
  if (kb?.length) await supabaseAdmin.from("ai_sdr_knowledge").insert(kb.map((k) => ({ ...k, org_id: org.id, campaign_id: newId, created_by: userId })));
  if (mem?.length) await supabaseAdmin.from("ai_sdr_memory").insert(mem.map((m) => ({ ...m, org_id: org.id, campaign_id: newId, created_by: userId })));

  // Optionally copy the audience as fresh (held) enrollments.
  if (copyLeads) {
    const { data: enr } = await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .select("candidate_name, candidate_email, candidate_source, job_id, email_status")
      .eq("campaign_id", id).eq("org_id", org.id).neq("status", "removed").limit(1000);
    if (enr?.length) {
      await supabaseAdmin.from("enterprise_campaign_enrollments").insert(
        enr.map((e) => ({ ...e, campaign_id: newId, org_id: org.id, status: "active", current_step_order: 0, next_send_at: null, enrolled_by: userId })),
      );
    }
  }

  return NextResponse.json({ data: { id: newId } });
}
