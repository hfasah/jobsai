import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg, DEMO_ORG_COOKIE, ACTIVE_WORKSPACE_COOKIE } from "@/lib/enterprise";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { CAMPAIGN_FEATURE_KEY } from "@/lib/campaigns";
import { isWithinSendWindow, type SendWindow } from "@/lib/outreach/send-window";
import { loadRotationPool } from "@/lib/outreach/rotation";
import { getConnectedSender } from "@/lib/outreach/connected-send";
import { loadSuppressedSet } from "@/lib/outreach/suppression";
import { getValidGoogleEnterpriseToken } from "@/lib/google-calendar-enterprise";

export const maxDuration = 60;

function isSuperAdmin(userId: string): boolean {
  return (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean).includes(userId);
}

// GET /api/enterprise/outreach/debug-send[?org=<id>] — DIAGNOSTIC. Returns the
// complete campaign-send ground truth as JSON: org-resolution context (the
// cookie overrides + memberships, since a multi-workspace user's campaigns can
// live in a different org than a raw request resolves to), the campaigns
// WHEREVER they live, per-enrolment guard verdicts mirroring the cron, send-row
// markers, sender/OAuth state, and a REAL Gmail API test send to yourself.
// Cross-org discovery + targeting is super-admin only.
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, CAMPAIGN_FEATURE_KEY);
  if (gate) return gate;

  const now = new Date();
  const out: Record<string, unknown> = { now: now.toISOString(), user: userId };

  // A. Resolution context — which org would this request operate in, and why.
  const jar = await cookies();
  out.cookie_overrides = {
    [DEMO_ORG_COOKIE]: jar.get(DEMO_ORG_COOKIE)?.value ?? null,
    [ACTIVE_WORKSPACE_COOKIE]: jar.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null,
  };
  const resolved = await getMyOrg(userId);
  out.resolved_org = resolved ? { id: resolved.id, name: resolved.name } : null;

  const { data: mems } = await supabaseAdmin
    .from("enterprise_members")
    .select("org_id, role, created_at, org:enterprise_orgs(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  const memberships = ((mems ?? []) as { org_id: string; role: string; created_at: string; org: { name: string } | null }[])
    .map((m) => ({ org_id: m.org_id, role: m.role, created_at: m.created_at, name: m.org?.name ?? null }));
  out.memberships = memberships;

  // B. Find the campaigns wherever they live. Members see their own orgs;
  // super-admin sees platform-wide (they operate client workspaces via cookie).
  const admin = isSuperAdmin(userId);
  out.is_super_admin = admin;
  const memIds = memberships.map((m) => m.org_id);
  let campQuery = supabaseAdmin
    .from("enterprise_campaigns")
    .select("id, name, status, org_id, updated_at, org:enterprise_orgs(name)")
    .in("status", ["active", "scheduled", "draft"])
    .order("updated_at", { ascending: false })
    .limit(25);
  if (!admin) campQuery = campQuery.in("org_id", memIds.length ? memIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: found } = await campQuery;
  const campaignsFound = ((found ?? []) as { id: string; name: string; status: string; org_id: string; updated_at: string; org: { name: string } | null }[])
    .map((c) => ({ id: c.id, name: c.name, status: c.status, org_id: c.org_id, org_name: c.org?.name ?? null }));
  out.campaigns_found = campaignsFound;

  // C. Target org: explicit ?org=, else the org of the newest ACTIVE campaign,
  // else the resolved org. Non-admins may only target their own orgs.
  const orgParam = new URL(req.url).searchParams.get("org");
  let targetOrgId = orgParam || campaignsFound.find((c) => c.status === "active")?.org_id || resolved?.id || null;
  if (!admin && targetOrgId && !memIds.includes(targetOrgId)) targetOrgId = resolved?.id ?? null;
  if (!targetOrgId) return NextResponse.json({ ...out, verdict: "No org to diagnose." });
  out.target_org = targetOrgId;

  // D. Full send-path diagnostics for the target org.
  const { data: camps } = await supabaseAdmin
    .from("enterprise_campaigns")
    .select("id, name, status, pilot_size, pilot_released, daily_send_limit, holidays, send_window_start, send_window_end, send_timezone, business_days_only, mailbox_strategy, mailbox_id")
    .eq("org_id", targetOrgId)
    .in("status", ["active", "scheduled", "draft"]);
  const campRows = (camps ?? []) as ({ id: string; name: string; status: string; pilot_size: number | null; pilot_released: boolean | null } & SendWindow & { daily_send_limit: number | null; holidays: string[] | null })[];
  out.campaigns = campRows.map((c) => ({ ...c, within_send_window_now: isWithinSendWindow(c, now) }));
  const allIds = campRows.map((c) => c.id);

  if (allIds.length > 0) {
    const { data: enr } = await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .select("id, campaign_id, candidate_email, candidate_name, status, current_step_order, next_send_at, last_sent_at, mailbox_id, email_status")
      .eq("org_id", targetOrgId)
      .in("campaign_id", allIds);
    const enrollments = (enr ?? []) as { id: string; campaign_id: string; candidate_email: string; candidate_name: string; status: string; current_step_order: number; next_send_at: string | null; last_sent_at: string | null; mailbox_id: string | null; email_status: string | null }[];

    const { data: steps } = await supabaseAdmin
      .from("enterprise_campaign_steps")
      .select("campaign_id, step_order, delay_days, ai_personalize")
      .in("campaign_id", allIds)
      .order("step_order", { ascending: true });
    out.steps = steps ?? [];

    const { data: sends } = await supabaseAdmin
      .from("enterprise_campaign_sends")
      .select("enrollment_id, campaign_id, step_order, sent_at, from_email")
      .in("campaign_id", allIds);
    const sendRows = (sends ?? []) as { enrollment_id: string; campaign_id: string; step_order: number; sent_at: string | null; from_email: string | null }[];
    out.send_rows = sendRows;

    const emails = enrollments.map((e) => e.candidate_email.toLowerCase());
    const suppressed = emails.length ? await loadSuppressedSet(targetOrgId, emails) : new Set<string>();
    out.suppressed_emails = [...suppressed];

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

    const { data: due } = await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .select("id")
      .eq("org_id", targetOrgId)
      .eq("status", "active")
      .not("next_send_at", "is", null)
      .lte("next_send_at", now.toISOString())
      .in("campaign_id", allIds);
    out.due_query_matches_now = (due ?? []).length;
  }

  // E. Sender resolution — for the target org AND every org the user belongs
  // to, so a mailbox registered under the wrong workspace is visible.
  const orgScan = [...new Set([targetOrgId, ...memIds])];
  const { data: mailboxes } = await supabaseAdmin
    .from("sending_mailboxes")
    .select("id, org_id, kind, address, status, paused_reason, created_by, daily_limit_cap")
    .in("org_id", orgScan);
  out.mailboxes_by_org = mailboxes ?? [];
  const pool = await loadRotationPool(targetOrgId);
  out.target_domain_pool_size = pool.mailboxes.length;
  const connected = await getConnectedSender(targetOrgId);
  out.target_connected_sender = connected;

  // F. OAuth token + REAL Gmail send test (to yourself — harmless, decisive).
  // Falls back to any gmail mailbox across the user's orgs when the target org
  // has none, so the send path gets tested either way.
  const gmailBox = connected?.kind === "gmail"
    ? connected
    : (((mailboxes ?? []) as { kind: string; address: string; created_by: string; id: string }[]).find((m) => m.kind === "gmail") ?? null);
  if (gmailBox) {
    const { data: acct } = await supabaseAdmin
      .from("enterprise_oauth_accounts")
      .select("email, expires_at, refresh_token, access_token")
      .eq("user_id", gmailBox.created_by)
      .eq("provider", "google")
      .maybeSingle();
    out.oauth_account = acct
      ? { email: acct.email, has_refresh_token: !!acct.refresh_token, has_access_token: !!acct.access_token, expires_at: acct.expires_at }
      : "NO google row in enterprise_oauth_accounts for the sender's user";

    const token = await getValidGoogleEnterpriseToken(gmailBox.created_by);
    out.gmail_token = token ? "obtained OK" : "FAILED — could not get/refresh a Google token";
    if (token) {
      const lines = [
        `From: ${gmailBox.address}`,
        `To: ${gmailBox.address}`,
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
        out.gmail_test_send = { from_mailbox: gmailBox.address, status: res.status, ok: res.ok, response: body.slice(0, 500) };
      } catch (err) {
        out.gmail_test_send = { from_mailbox: gmailBox.address, error: String(err).slice(0, 300) };
      }
    }
  } else {
    out.gmail_test_send = "no gmail mailbox found in any of your orgs";
  }

  return NextResponse.json(out);
}
