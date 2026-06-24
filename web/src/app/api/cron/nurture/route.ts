import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { NURTURE_LETTERS, sendNurtureEmail } from "@/lib/email";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const THROTTLE_MS = 200;       // ~5/sec, gentle on Resend
const MIN_GAP_DAYS = 7;        // at most one nurture letter per user per week
const MAX_SENDS_PER_RUN = 300; // bound a single run
const DAY = 86_400_000;

// GET /api/cron/nurture — weekly drip. Sends each due user the next unsent
// letter in NURTURE_LETTERS (paced, opt-out-aware, idempotent via nurture_emails).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sorted = [...NURTURE_LETTERS].sort((a, b) => a.order - b.order);

  // Opt-outs to skip, and every nurture send so far (for sequencing + pacing).
  const [{ data: optRows }, { data: nurtureRows }] = await Promise.all([
    supabaseAdmin.from("user_preferences").select("user_id").eq("alert_emails_enabled", false),
    supabaseAdmin.from("nurture_emails").select("user_id, letter_key, sent_at"),
  ]);
  const optedOut = new Set((optRows ?? []).map((r) => r.user_id as string));
  const sentKeys = new Map<string, Set<string>>();
  const lastSent = new Map<string, number>();
  for (const r of nurtureRows ?? []) {
    const uid = r.user_id as string;
    if (!sentKeys.has(uid)) sentKeys.set(uid, new Set());
    sentKeys.get(uid)!.add(r.letter_key as string);
    const t = r.sent_at ? Date.parse(r.sent_at as string) : 0;
    if (t > (lastSent.get(uid) ?? 0)) lastSent.set(uid, t);
  }

  const client = await clerkClient();
  const pageSize = 100;
  let offset = 0;
  let totalCount = Number.POSITIVE_INFINITY;
  const now = Date.now();
  let sent = 0, skipped = 0, failed = 0;

  while (sent < MAX_SENDS_PER_RUN && offset < totalCount) {
    const list = await client.users.getUserList({ limit: pageSize, offset });
    totalCount = list.totalCount;
    if (list.data.length === 0) break;

    for (const user of list.data) {
      if (sent >= MAX_SENDS_PER_RUN) break;
      const uid = user.id;
      if (optedOut.has(uid)) { skipped++; continue; }

      const to = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
      if (!to) { skipped++; continue; }

      // Pace: at most one nurture letter per MIN_GAP_DAYS.
      const last = lastSent.get(uid);
      if (last && now - last < MIN_GAP_DAYS * DAY) { skipped++; continue; }

      const ageDays = (now - (user.createdAt ?? now)) / DAY;
      const already = sentKeys.get(uid) ?? new Set<string>();
      const next = sorted.find((l) => !already.has(l.key) && ageDays >= l.minDays);
      if (!next) { skipped++; continue; }

      const result = await sendNurtureEmail({ userId: uid, to, firstName: user.firstName, key: next.key });
      if (result.ok) {
        await supabaseAdmin.from("nurture_emails").upsert(
          { user_id: uid, letter_key: next.key, sent_at: new Date().toISOString() },
          { onConflict: "user_id,letter_key" },
        );
        sent++;
        await sleep(THROTTLE_MS);
      } else {
        failed++;
        console.warn(`[cron/nurture] send failed (${uid}, ${next.key}): ${result.error}`);
      }
    }
    offset += pageSize;
  }

  const summary = { sent, skipped, failed, total_users: Number.isFinite(totalCount) ? totalCount : null };
  console.log("[cron/nurture]", summary);
  return NextResponse.json({ ok: true, ...summary });
}
