import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY } from "@/lib/campaigns";
import { isWithinSendWindow, type SendWindow } from "@/lib/outreach/send-window";
import { loadRotationPool } from "@/lib/outreach/rotation";
import { getConnectedSender } from "@/lib/outreach/connected-send";
import { loadSuppressedSet } from "@/lib/outreach/suppression";
import { getValidGoogleEnterpriseToken } from "@/lib/google-calendar-enterprise";

export const maxDuration = 60;

// GET /api/enterprise/outreach/debug-send — DIAGNOSTIC. Vercel's log stream
// keeps truncating the campaign cron's output, so this endpoint returns the
// complete send-path ground truth as JSON instead: live campaigns, every
// enrolment's schedule/state, existing send rows, each cron guard's verdict,
// mailbox + OAuth state, and a REAL test send (to yourself) through the exact
// Gmail API path the cron uses — with Gmail's raw response. Org-scoped,
// auth + feature gated. Safe: the only email it sends is to your own mailbox.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const now = new Date();
  const out: Record<string, unknown> = { now: now.toISOString(), org: org.id };

  // 1. Live campaigns + their send controls.
  const { data: camps } = await supabaseAdmin
    .from("enterprise_campaigns")
    .select("id, name, status, pilot_size, pilot_released, daily_send_limit, holidays, send_window_start, send_window_end, send_timezone, business_days_only, mailbox_strategy, mailbox_id")
    .eq("org_id", org.id)
    .in("status", ["active", "scheduled", "draft"]);
  const campRows = (camps ?? []) as ({ id: string; name: string; status: string; pilot_size: number | null; pilot_released: boolean | null } & SendWindow & { daily_send_limit: number | null; holidays: string[] | null })[];
  out.campaigns = campRows.map((c) => ({
    ...c,
    within_send_window_now: isWithinSendWindow(c, now),
  }));
  const liveIds = campRows.filter((c) => c.status === "active").map((c) => c.id);
  const allIds = campRows.map((c) => c.id);
  if (allIds.length === 0) return NextResponse.json({ ...out, verdict: "No campaigns found for this org." });

  // 2. Every enrolment's schedule/state.
  const { data: enr } = await supabaseAdmin
    .from("enterprise_campaign_enrollments")
    .select("id, campaign_id, candidate_email, candidate_name, status, current_step_order, next_send_at, last_sent_at, mailbox_id, email_status")
    .eq("org_id", org.id)
    .in("campaign_id", allIds);
  const enrollments = (enr ?? []) as { id: string; campaign_id: string; candidate_email: string; candidate_name: string; status: string; current_step_order: number; next_send_at: string | null; last_sent_at: string | null; mailbox_id: string | null; email_status: string | null }[];

  // 3. Steps per campaign.
  const { data: steps } = await supabaseAdmin
    .from("enterprise_campaign_steps")
    .select("campaign_id, step_order, delay_days, ai_personalize")
    .in("campaign_id", allIds)
    .order("step_order", { ascending: true });
  out.steps = steps ?? [];

  // 4. Existing send rows (the idempotency markers).
  const { data: sends } = await supabaseAdmin
    .from("enterprise_campaign_sends")
    .select("enrollment_id, campaign_id, step_order, sent_at, from_email")
    .in("campaign_id", allIds);
  const sendRows = (sends ?? []) as { enrollment_id: string; campaign_id: string; step_order: number; sent_at: string | null; from_email: string | null }[];
  out.send_rows = sendRows;

  // 5. Suppression state for every enrolled address.
  const emails = enrollments.map((e) => e.candidate_email.toLowerCase());
  const suppressed = emails.length ? await loadSuppressedSet(org.id, emails) : new Set<string>();
  out.suppressed_emails = [...suppressed];

  // 6. Per-enrolment verdict — replicate each cron guard in order.
  const campById = new Map(campRows.map((c) => [c.id, c]));
  out.enrollments = enrollments.map((e) => {
    const c = campById.get(e.campaign_id);
    const reasons: string[] = [];
    if (!c) reasons.push("campaign row missing");
    else {
      if (c.status !== "active") reasons.push(`campaign status is '${c.status}' (cron only sends for active)`);
      if (e.status !== "active") reasons.push(`enrolment status is '${e.status}'`);
      if (e.next_send_at === null) reasons.push("next_send_at is NULL (unscheduled)");
      else if (new Date(e.next_send_at) > now) reasons.push(`next_send_at is ${Math.round((new Date(e.next_send_at).getTime() - now.getTime()) / 1000)}s in the FUTURE`);
      if (suppressed.has(e.candidate_email.toLowerCase())) reasons.push("on Do-Not-Contact");
      if (!isWithinSendWindow(c, now)) reasons.push("outside send window");
      const marker = sendRows.find((s) => s.enrollment_id === e.id && s.step_order === e.current_step_order);
      if (marker) reasons.push(`send row already exists for step ${e.current_step_order} (sent_at=${marker.sent_at}, from=${marker.from_email}) — cron would skip`);
      if (e.email_status === "invalid") reasons.push("email_status invalid (auto-retired at send)");
    }
    return { ...e, would_send_now: reasons.length === 0, blockers: reasons };
  });

  // 7. Due-query replica (exactly what the cron selects).
  const { data: due } = await supabaseAdmin
    .from("enterprise_campaign_enrollments")
    .select("id, candidate_email, campaign_id")
    .eq("org_id", org.id)
    .eq("status", "active")
    .not("next_send_at", "is", null)
    .lte("next_send_at", now.toISOString())
    .in("campaign_id", allIds);
  out.due_query_matches_now = (due ?? []).length;

  // 8. Mailboxes + sender resolution (what the cron would use).
  const { data: mailboxes } = await supabaseAdmin
    .from("sending_mailboxes")
    .select("id, kind, address, status, paused_reason, created_by, daily_limit_cap")
    .eq("org_id", org.id);
  out.mailboxes = mailboxes ?? [];
  const pool = await loadRotationPool(org.id);
  out.domain_pool_size = pool.mailboxes.length;
  const connected = await getConnectedSender(org.id);
  out.connected_sender = connected;
  out.live_campaign_ids = liveIds;

  // 9. OAuth token + REAL Gmail send test (to yourself — harmless, decisive).
  if (connected?.kind === "gmail") {
    const { data: acct } = await supabaseAdmin
      .from("enterprise_oauth_accounts")
      .select("email, expires_at, refresh_token, access_token")
      .eq("user_id", connected.created_by)
      .eq("provider", "google")
      .maybeSingle();
    out.oauth_account = acct
      ? { email: acct.email, has_refresh_token: !!acct.refresh_token, has_access_token: !!acct.access_token, expires_at: acct.expires_at }
      : "NO google row in enterprise_oauth_accounts for the sender's user";

    const token = await getValidGoogleEnterpriseToken(connected.created_by);
    out.gmail_token = token ? "obtained OK" : "FAILED — could not get/refresh a Google token";
    if (token) {
      const lines = [
        `From: ${connected.address}`,
        `To: ${connected.address}`,
        "Subject: [JobsAI DEBUG] campaign send-path test",
        'Content-Type: text/html; charset="UTF-8"',
        "MIME-Version: 1.0",
        "",
        "<p>This is a diagnostic test of the campaign Gmail send path. Safe to delete.</p>",
      ];
      const raw = Buffer.from(lines.join("\r\n")).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      try {
        const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ raw }),
        });
        const body = await res.text();
        out.gmail_test_send = { status: res.status, ok: res.ok, response: body.slice(0, 500) };
      } catch (err) {
        out.gmail_test_send = { error: String(err).slice(0, 300) };
      }
    }
  } else if (connected) {
    out.oauth_account = `connected sender is ${connected.kind} — Gmail test skipped`;
  } else {
    out.oauth_account = "NO connected sender resolved for this org";
  }

  return NextResponse.json(out);
}
