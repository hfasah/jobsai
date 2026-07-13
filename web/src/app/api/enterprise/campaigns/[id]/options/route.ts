import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY } from "@/lib/campaigns";

type Ctx = { params: Promise<{ id: string }> };

async function guard(id: string) {
  const { userId } = await auth();
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return { error: gate };
  const org = await getMyOrg(userId);
  if (!org) return { error: NextResponse.json({ error: "No organization." }, { status: 404 }) };
  const { data: campaign } = await supabaseAdmin.from("enterprise_campaigns").select("id").eq("id", id).eq("org_id", org.id).maybeSingle();
  if (!campaign) return { error: NextResponse.json({ error: "Campaign not found." }, { status: 404 }) };
  return { org };
}

// GET — the campaign's deliverability/dedup options.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const g = await guard(id);
  if (g.error) return g.error;
  const { data } = await supabaseAdmin
    .from("enterprise_campaigns").select("track_opens, dedup_days, allow_unverified, mailbox_strategy, mailbox_id, daily_send_limit, holidays, send_jitter_hours").eq("id", id).eq("org_id", g.org.id).maybeSingle();
  return NextResponse.json({ data });
}

// PATCH — update options.
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const g = await guard(id);
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.track_opens === "boolean") update.track_opens = body.track_opens;
  if (typeof body.allow_unverified === "boolean") update.allow_unverified = body.allow_unverified;
  if ("dedup_days" in body) {
    update.dedup_days = typeof body.dedup_days === "number" && body.dedup_days > 0 ? Math.min(365, Math.floor(body.dedup_days)) : null;
  }
  if (body.mailbox_strategy === "auto" || body.mailbox_strategy === "fixed") update.mailbox_strategy = body.mailbox_strategy;
  if ("mailbox_id" in body) update.mailbox_id = typeof body.mailbox_id === "string" && body.mailbox_id ? body.mailbox_id : null;
  if ("daily_send_limit" in body) update.daily_send_limit = typeof body.daily_send_limit === "number" && body.daily_send_limit > 0 ? Math.floor(body.daily_send_limit) : null;
  if (typeof body.send_jitter_hours === "number") update.send_jitter_hours = Math.max(0, Math.min(48, Math.floor(body.send_jitter_hours)));
  if (Array.isArray(body.holidays)) {
    update.holidays = body.holidays.filter((d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)).slice(0, 60);
  }
  if (Object.keys(update).length === 1) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  await supabaseAdmin.from("enterprise_campaigns").update(update).eq("id", id).eq("org_id", g.org.id);
  return NextResponse.json({ ok: true });
}
