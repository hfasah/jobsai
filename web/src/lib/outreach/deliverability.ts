// Deliverability engine — deterministic, explainable rules (no ML, no synthetic
// warm-up network):
//   * Ramp-up: a mailbox's effective daily limit starts at RAMP_START and grows
//     ~20%/day toward its cap. Computed from ramp_started_at — nothing to cron.
//   * Thresholds: 7-day bounce rate > 5% (min 25 sends) or complaint rate
//     > 0.3% auto-pauses the mailbox.
//   * Enforcement: reserveSend() atomically bumps today's counter and refuses
//     past the effective limit.
// SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/enterprise-audit";

export const RAMP_START = 15;
export const RAMP_GROWTH = 1.2; // +20%/day
export const BOUNCE_RATE_PAUSE = 0.05;
export const BOUNCE_MIN_SENDS = 25;
export const COMPLAINT_RATE_PAUSE = 0.003;

export interface MailboxRow {
  id: string;
  org_id: string;
  kind: "domain" | "gmail" | "microsoft";
  address: string;
  status: "active" | "paused";
  paused_reason: string | null;
  ramp_started_at: string;
  daily_limit_cap: number;
}

export interface MailboxHealth {
  effective_daily_limit: number;
  sends_today: number;
  remaining_today: number;
  sends_7d: number;
  bounces_7d: number;
  complaints_7d: number;
  bounce_rate_7d: number;
  ramp_day: number;      // days since ramp start (1-based)
  ramp_complete: boolean;
}

export function effectiveDailyLimit(rampStartedAt: string, cap: number): number {
  const days = Math.max(0, Math.floor((Date.now() - new Date(rampStartedAt).getTime()) / 86_400_000));
  const ramped = Math.floor(RAMP_START * Math.pow(RAMP_GROWTH, days));
  return Math.max(1, Math.min(cap, ramped));
}

async function statsSince(mailboxId: string, orgId: string, sinceDay: string) {
  const { data } = await supabaseAdmin
    .from("sending_mailbox_stats")
    .select("day, sends, bounces, complaints")
    .eq("mailbox_id", mailboxId)
    .eq("org_id", orgId)
    .gte("day", sinceDay);
  return (data ?? []) as { day: string; sends: number; bounces: number; complaints: number }[];
}

export async function getMailboxHealth(mailbox: MailboxRow): Promise<MailboxHealth> {
  const today = new Date().toISOString().slice(0, 10);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const rows = await statsSince(mailbox.id, mailbox.org_id, weekAgo);

  const sendsToday = rows.find((r) => r.day === today)?.sends ?? 0;
  const sends7d = rows.reduce((s, r) => s + r.sends, 0);
  const bounces7d = rows.reduce((s, r) => s + r.bounces, 0);
  const complaints7d = rows.reduce((s, r) => s + r.complaints, 0);
  const limit = effectiveDailyLimit(mailbox.ramp_started_at, mailbox.daily_limit_cap);
  const rampDay = Math.floor((Date.now() - new Date(mailbox.ramp_started_at).getTime()) / 86_400_000) + 1;

  return {
    effective_daily_limit: limit,
    sends_today: sendsToday,
    remaining_today: Math.max(0, limit - sendsToday),
    sends_7d: sends7d,
    bounces_7d: bounces7d,
    complaints_7d: complaints7d,
    bounce_rate_7d: sends7d > 0 ? bounces7d / sends7d : 0,
    ramp_day: rampDay,
    ramp_complete: limit >= mailbox.daily_limit_cap,
  };
}

// Atomically claim one send slot for today. Refuses when the mailbox is
// paused or the effective daily limit is reached. Callers send only on ok.
export async function reserveSend(mailbox: MailboxRow): Promise<{ ok: boolean; reason?: string; sendsToday?: number }> {
  if (mailbox.status !== "active") return { ok: false, reason: mailbox.paused_reason ?? "paused" };
  const limit = effectiveDailyLimit(mailbox.ramp_started_at, mailbox.daily_limit_cap);
  const { data, error } = await supabaseAdmin.rpc("sending_mailbox_record_send", {
    p_mailbox: mailbox.id,
    p_org: mailbox.org_id,
  });
  if (error) return { ok: false, reason: "counter_error" };
  const sendsToday = (Array.isArray(data) ? data[0] : data) as number;
  if (sendsToday > limit) {
    return { ok: false, reason: "daily_limit", sendsToday };
    // NOTE: the reserved slot past the limit is intentionally left counted —
    // it biases toward safety (never under-counts).
  }
  return { ok: true, sendsToday };
}

async function pauseMailbox(mailbox: MailboxRow, reason: string): Promise<void> {
  await supabaseAdmin
    .from("sending_mailboxes")
    .update({ status: "paused", paused_reason: reason, paused_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", mailbox.id)
    .eq("org_id", mailbox.org_id);
  audit({
    org_id: mailbox.org_id,
    action: "outreach.mailbox_paused",
    resource_type: "sending_mailbox",
    resource_id: mailbox.id,
    metadata: { reason, address: mailbox.address },
  });
}

// Record a bounce/complaint and evaluate auto-pause thresholds.
export async function recordNegativeEvent(
  mailbox: MailboxRow,
  kind: "bounce" | "complaint",
): Promise<{ paused: boolean }> {
  const today = new Date().toISOString().slice(0, 10);
  const col = kind === "bounce" ? "bounces" : "complaints";
  // upsert-and-increment today's row
  const { data: existing } = await supabaseAdmin
    .from("sending_mailbox_stats")
    .select("sends, bounces, complaints")
    .eq("mailbox_id", mailbox.id)
    .eq("day", today)
    .maybeSingle();
  const row = existing as { sends: number; bounces: number; complaints: number } | null;
  await supabaseAdmin.from("sending_mailbox_stats").upsert(
    {
      mailbox_id: mailbox.id,
      org_id: mailbox.org_id,
      day: today,
      sends: row?.sends ?? 0,
      bounces: (row?.bounces ?? 0) + (kind === "bounce" ? 1 : 0),
      complaints: (row?.complaints ?? 0) + (kind === "complaint" ? 1 : 0),
    },
    { onConflict: "mailbox_id,day" },
  );

  if (mailbox.status !== "active") return { paused: false };
  const health = await getMailboxHealth(mailbox);
  if (kind === "complaint" && health.sends_7d > 0 && health.complaints_7d / health.sends_7d > COMPLAINT_RATE_PAUSE) {
    await pauseMailbox(mailbox, "complaint_rate");
    return { paused: true };
  }
  if (health.sends_7d >= BOUNCE_MIN_SENDS && health.bounce_rate_7d > BOUNCE_RATE_PAUSE) {
    await pauseMailbox(mailbox, "bounce_rate");
    return { paused: true };
  }
  return { paused: false };
}
