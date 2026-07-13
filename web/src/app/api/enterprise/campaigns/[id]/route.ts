import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY, validateSteps, type CampaignStepInput } from "@/lib/campaigns";
import { preflightCampaign } from "@/lib/outreach/preflight";

type Ctx = { params: Promise<{ id: string }> };

async function authedOrg() {
  const { userId } = await auth();
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return { error: gate };
  const org = await getMyOrg(userId);
  if (!org) return { error: NextResponse.json({ error: "No organization." }, { status: 404 }) };
  return { userId, org };
}

// GET — full campaign with ordered steps.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const a = await authedOrg();
  if (a.error) return a.error;
  const { id } = await params;

  const { data: campaign } = await supabaseAdmin
    .from("enterprise_campaigns")
    .select("*")
    .eq("id", id)
    .eq("org_id", a.org.id)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: steps } = await supabaseAdmin
    .from("enterprise_campaign_steps")
    .select("*")
    .eq("campaign_id", id)
    .order("step_order", { ascending: true });

  return NextResponse.json({ data: { ...campaign, steps: steps ?? [] } });
}

// PATCH — update name/description/status and/or replace the step list.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const a = await authedOrg();
  if (a.error) return a.error;
  const { id } = await params;

  const { data: campaign } = await supabaseAdmin
    .from("enterprise_campaigns")
    .select("id, status")
    .eq("id", id)
    .eq("org_id", a.org.id)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const currentStatus = (campaign as { status: string }).status;

  const body = await req.json().catch(() => ({}));
  const { name, description, status, steps, send_window, objective, pilot_size, scheduled_at } = body as {
    name?: string; description?: string; status?: string; steps?: CampaignStepInput[];
    send_window?: { start?: number | null; end?: number | null; timezone?: string | null; business_days_only?: boolean };
    objective?: string;
    pilot_size?: number | null;
    scheduled_at?: string | null;
  };
  const pilotSize = typeof pilot_size === "number" && pilot_size > 0 ? Math.floor(pilot_size) : null;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof name === "string") {
    if (!name.trim()) return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
    update.name = name.trim();
  }
  if (typeof description === "string") update.description = description.trim() || null;
  if (typeof objective === "string") {
    update.objective = ["source", "re_engage", "promote", "pipeline"].includes(objective) ? objective : null;
  }
  if (typeof status === "string" && !["draft", "scheduled", "active", "paused", "stopped", "completed", "archived", "error"].includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  // Guard the irreversible transitions: a stopped or completed campaign can't be
  // resumed (only archived). Everything else is allowed.
  if (typeof status === "string" && status !== currentStatus) {
    if (currentStatus === "stopped" && status !== "archived") {
      return NextResponse.json({ error: "A stopped campaign can't be resumed — duplicate it to run again." }, { status: 400 });
    }
    if (currentStatus === "completed" && !["archived", "active"].includes(status)) {
      return NextResponse.json({ error: "A completed campaign can only be archived." }, { status: 400 });
    }
  }
  if (send_window && typeof send_window === "object") {
    const start = send_window.start;
    const end = send_window.end;
    update.send_window_start = typeof start === "number" && start >= 0 && start <= 23 ? Math.floor(start) : null;
    update.send_window_end = typeof end === "number" && end >= 1 && end <= 24 ? Math.floor(end) : null;
    update.send_timezone = typeof send_window.timezone === "string" && send_window.timezone.trim() ? send_window.timezone.trim() : null;
    update.business_days_only = send_window.business_days_only === true;
  }

  // Replacing steps is destructive — only when the client explicitly sends them.
  // (Runs BEFORE the activation preflight so a single save-and-launch request
  // validates the steps it just wrote.)
  if (Array.isArray(steps)) {
    const stepErr = validateSteps(steps);
    if (stepErr) return NextResponse.json({ error: stepErr }, { status: 400 });
    await supabaseAdmin.from("enterprise_campaign_steps").delete().eq("campaign_id", id);
    const rows = steps.map((s, i) => ({
      campaign_id: id,
      step_order: i,
      delay_days: Math.max(0, Math.min(60, Math.round(s.delay_days || 0))),
      subject: s.subject.trim(),
      body: s.body.trim(),
      ai_personalize: !!s.ai_personalize,
      ai_prompt: s.ai_prompt?.trim() || null,
      ab_subject: s.ab_subject?.trim() || null,
      ab_body: s.ab_body?.trim() || null,
      skip_if_in_pipeline: !!s.skip_if_in_pipeline,
    }));
    const { error } = await supabaseAdmin.from("enterprise_campaign_steps").insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Apply content/settings edits first — they should survive a blocked launch.
  await supabaseAdmin.from("enterprise_campaigns").update(update).eq("id", id);

  // HARD LAUNCH GATE: activating a campaign requires a passing preflight
  // (steps and settings above are already saved, so the preflight sees the
  // exact state that would go live). Failures return 422 with the full check
  // list so the UI shows exactly what to fix; warns don't block.
  if (typeof status === "string") {
    // Both an immediate launch and a scheduled one must pass the preflight now —
    // don't let a broken campaign go live later.
    if (status === "active" || status === "scheduled") {
      const preflight = await preflightCampaign(a.org.id, id);
      if (!preflight.ok) {
        return NextResponse.json(
          { error: "Launch blocked — fix the failing checks first.", preflight },
          { status: 422 },
        );
      }
    }
    const statusPatch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (status === "scheduled") statusPatch.scheduled_at = scheduled_at ?? null;
    if (status === "active") statusPatch.scheduled_at = null; // launched — clear any schedule
    await supabaseAdmin
      .from("enterprise_campaigns")
      .update(statusPatch)
      .eq("id", id)
      .eq("org_id", a.org.id);

    // Pilot launch: hold everyone past the first N so only the pilot batch sends.
    // The held enrollments stay active with next_send_at cleared; "Release the
    // rest" (below) re-schedules them.
    if (status === "active" && pilotSize) {
      const { data: enr } = await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .select("id")
        .eq("campaign_id", id)
        .eq("org_id", a.org.id)
        .eq("status", "active")
        .order("enrolled_at", { ascending: true });
      const heldIds = ((enr ?? []) as { id: string }[]).slice(pilotSize).map((r) => r.id);
      for (let i = 0; i < heldIds.length; i += 100) {
        await supabaseAdmin
          .from("enterprise_campaign_enrollments")
          .update({ next_send_at: null })
          .in("id", heldIds.slice(i, i + 100));
      }
      await supabaseAdmin
        .from("enterprise_campaigns")
        .update({ pilot_size: pilotSize, pilot_released: false })
        .eq("id", id)
        .eq("org_id", a.org.id);
    }
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remove the campaign (cascades steps/enrollments/sends).
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const a = await authedOrg();
  if (a.error) return a.error;
  const { id } = await params;

  const { error } = await supabaseAdmin
    .from("enterprise_campaigns")
    .delete()
    .eq("id", id)
    .eq("org_id", a.org.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
