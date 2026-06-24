import { clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin";
import { sendWelcomeEmail } from "@/lib/email";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const THROTTLE_MS = 200; // ~5/sec — gentle on Resend's rate limit

// POST /api/admin/backfill-welcome — ONE-TIME: re-send the welcome email to
// existing users (the original sends never delivered, see #165). Idempotent via
// welcome_emails.backfilled_at, honors the alert-email opt-out, throttled.
// Auth: admin (ADMIN_USER_IDS) OR `Authorization: Bearer ${CRON_SECRET}`.
//   ?dry=1     count who WOULD be sent, send nothing
//   ?limit=N   cap sends this call (default 200, max 1000) — re-run for the rest
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  const secret = process.env.CRON_SECRET;
  const viaCron = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
  if (!admin.ok && !viaCron) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const dry = sp.get("dry") === "1";
  const limit = Math.min(Math.max(parseInt(sp.get("limit") ?? "200", 10) || 200, 1), 1000);

  // Already-backfilled + opted-out user ids → skip.
  const [{ data: doneRows }, { data: optRows }] = await Promise.all([
    supabaseAdmin.from("welcome_emails").select("user_id").not("backfilled_at", "is", null),
    supabaseAdmin.from("user_preferences").select("user_id").eq("alert_emails_enabled", false),
  ]);
  const skip = new Set<string>([
    ...(doneRows ?? []).map((r) => r.user_id as string),
    ...(optRows ?? []).map((r) => r.user_id as string),
  ]);

  const client = await clerkClient();
  const pageSize = 100;
  let offset = 0;
  let totalCount = Number.POSITIVE_INFINITY;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  while (sent < limit && offset < totalCount) {
    const list = await client.users.getUserList({ limit: pageSize, offset });
    totalCount = list.totalCount;
    if (list.data.length === 0) break;

    for (const user of list.data) {
      if (sent >= limit) break;
      if (skip.has(user.id)) { skipped++; continue; }
      const to = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress;
      if (!to) { skipped++; continue; }

      if (dry) { sent++; continue; }

      const result = await sendWelcomeEmail({ to, firstName: user.firstName });
      if (result.ok) {
        await supabaseAdmin
          .from("welcome_emails")
          .upsert({ user_id: user.id, email: to, backfilled_at: new Date().toISOString() }, { onConflict: "user_id" });
        sent++;
        await sleep(THROTTLE_MS);
      } else {
        failed++; // leave unmarked → next run retries
        console.warn(`[backfill-welcome] send failed for ${user.id}: ${result.error}`);
      }
    }
    offset += pageSize;
  }

  const total = Number.isFinite(totalCount) ? totalCount : null;
  const remaining = total != null ? Math.max(0, total - skip.size - (dry ? 0 : sent)) : null;
  return NextResponse.json({ ok: true, dry, sent, skipped, failed, total_users: total, remaining });
}
