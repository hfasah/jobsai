// Mailbox rotation for campaign sends: spread volume across the org's healthy
// domain mailboxes instead of saturating one. Selection prefers the mailbox
// with the most remaining capacity today; reserveSend() (atomic) is the final
// arbiter, so two cron workers can't oversend. SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";
import { effectiveDailyLimit, reserveSend, type MailboxRow } from "./deliverability";

export interface RotationPool {
  mailboxes: (MailboxRow & { display_name: string | null; remaining: number })[];
}

// One batched load per org per cron run.
export async function loadRotationPool(orgId: string): Promise<RotationPool> {
  const { data: boxes } = await supabaseAdmin
    .from("sending_mailboxes")
    .select("id, org_id, kind, address, display_name, status, paused_reason, ramp_started_at, daily_limit_cap")
    .eq("org_id", orgId)
    .eq("kind", "domain")
    .eq("status", "active");
  const rows = (boxes ?? []) as (MailboxRow & { display_name: string | null })[];
  if (rows.length === 0) return { mailboxes: [] };

  const today = new Date().toISOString().slice(0, 10);
  const { data: stats } = await supabaseAdmin
    .from("sending_mailbox_stats")
    .select("mailbox_id, sends")
    .eq("org_id", orgId)
    .eq("day", today)
    .in("mailbox_id", rows.map((r) => r.id));
  const sendsToday = new Map(((stats ?? []) as { mailbox_id: string; sends: number }[]).map((s) => [s.mailbox_id, s.sends]));

  return {
    mailboxes: rows.map((m) => ({
      ...m,
      remaining: Math.max(0, effectiveDailyLimit(m.ramp_started_at, m.daily_limit_cap) - (sendsToday.get(m.id) ?? 0)),
    })),
  };
}

// Claim a send slot from the pool. Tries mailboxes in remaining-capacity order;
// decrements local bookkeeping on success so subsequent picks in the same cron
// run stay balanced. Returns null when the whole pool is exhausted.
export async function claimFromPool(pool: RotationPool, preferredId?: string | null): Promise<(MailboxRow & { display_name: string | null }) | null> {
  // Fixed strategy: try the chosen mailbox first; fall through to the pool if
  // it's unavailable or out of capacity.
  const preferred = preferredId ? pool.mailboxes.filter((m) => m.id === preferredId) : [];
  const rest = pool.mailboxes.filter((m) => m.id !== preferredId).sort((a, b) => b.remaining - a.remaining);
  const candidates = [...preferred, ...rest];
  for (const mailbox of candidates) {
    if (mailbox.remaining <= 0) continue;
    const res = await reserveSend(mailbox);
    if (res.ok) {
      mailbox.remaining -= 1;
      return mailbox;
    }
    mailbox.remaining = 0; // reserveSend refused → treat as exhausted for this run
  }
  return null;
}

// Claim a slot on ONE specific mailbox only — no fall-through to the pool. Used
// to keep a candidate locked to their assigned sender across the whole sequence.
// Returns null if that mailbox is absent (e.g. paused, so not in the pool),
// exhausted, or the atomic reservation refuses — caller should defer, not switch.
export async function claimSpecificMailbox(pool: RotationPool, id: string): Promise<(MailboxRow & { display_name: string | null }) | null> {
  const mailbox = pool.mailboxes.find((m) => m.id === id);
  if (!mailbox || mailbox.remaining <= 0) return null;
  const res = await reserveSend(mailbox);
  if (res.ok) {
    mailbox.remaining -= 1;
    return mailbox;
  }
  mailbox.remaining = 0;
  return null;
}
