// Campaign health diagnosis — the "Diagnose" button. Runs the launch preflight
// plus runtime health checks (bounce/unsubscribe rates, unverified emails, AI
// SDR readiness, mailbox health) and returns a 0-100 score with critical
// errors, warnings, and recommendations. SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";
import { preflightCampaign } from "./preflight";

export type DiagnoseLevel = "critical" | "warning" | "ok";
export interface DiagnoseIssue { level: DiagnoseLevel; label: string; detail: string; recommendation?: string }
export interface DiagnoseResult { score: number; issues: DiagnoseIssue[] }

export async function diagnoseCampaign(orgId: string, campaignId: string): Promise<DiagnoseResult> {
  const issues: DiagnoseIssue[] = [];

  const [preflight, { data: campaign }, { data: enrollments }, { count: kbCount }, { data: mailboxes }] = await Promise.all([
    preflightCampaign(orgId, campaignId),
    supabaseAdmin.from("enterprise_campaigns").select("status, ai_sdr_enabled, ai_sdr_mode").eq("id", campaignId).eq("org_id", orgId).maybeSingle(),
    supabaseAdmin.from("enterprise_campaign_enrollments").select("status, email_status").eq("campaign_id", campaignId).eq("org_id", orgId).neq("status", "removed").limit(2000),
    supabaseAdmin.from("ai_sdr_knowledge").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("org_id", orgId),
    supabaseAdmin.from("sending_mailboxes").select("status").eq("org_id", orgId),
  ]);

  // Launch preflight → critical (fail) / warning (warn).
  for (const c of preflight.checks) {
    if (c.status === "fail") issues.push({ level: "critical", label: c.label, detail: c.detail });
    else if (c.status === "warn") issues.push({ level: "warning", label: c.label, detail: c.detail });
  }

  const rows = (enrollments ?? []) as { status: string; email_status: string | null }[];
  const total = rows.length;
  const contacted = rows.filter((e) => ["active", "replied", "completed", "bounced", "unsubscribed"].includes(e.status)).length;
  const bounced = rows.filter((e) => e.status === "bounced").length;
  const unsubscribed = rows.filter((e) => e.status === "unsubscribed").length;
  const unverified = rows.filter((e) => e.email_status !== "valid" && e.email_status !== "risky").length;

  // Deliverability health.
  if (contacted >= 20) {
    const bounceRate = bounced / contacted;
    if (bounceRate >= 0.1) issues.push({ level: "critical", label: "Bounce rate", detail: `${Math.round(bounceRate * 100)}% of contacted leads bounced.`, recommendation: "Pause and verify remaining emails before sending more." });
    else if (bounceRate >= 0.05) issues.push({ level: "warning", label: "Bounce rate", detail: `${Math.round(bounceRate * 100)}% bounce rate is approaching risky levels.`, recommendation: "Verify emails and slow the daily limit." });
    const unsubRate = unsubscribed / contacted;
    if (unsubRate >= 0.03) issues.push({ level: "warning", label: "Unsubscribe rate", detail: `${Math.round(unsubRate * 100)}% unsubscribe rate is high.`, recommendation: "Review targeting and messaging." });
  }
  if (total > 0 && unverified > 0) {
    issues.push({ level: "warning", label: "Unverified emails", detail: `${unverified} of ${total} leads don't have a verified email.`, recommendation: "Reveal & verify them — auto-send only goes to verified/likely-valid addresses." });
  }

  // AI SDR readiness.
  const c = campaign as { ai_sdr_enabled?: boolean; ai_sdr_mode?: string } | null;
  if (c?.ai_sdr_enabled && c.ai_sdr_mode === "auto" && (kbCount ?? 0) === 0) {
    issues.push({ level: "warning", label: "AI SDR", detail: "Auto-reply is on but the campaign has no knowledge base.", recommendation: "Add knowledge-base docs so the AI answers accurately, or switch to draft mode." });
  }

  // Sending identity health.
  const activeMailboxes = ((mailboxes ?? []) as { status: string }[]).filter((m) => m.status === "active").length;
  const pausedMailboxes = ((mailboxes ?? []) as { status: string }[]).filter((m) => m.status === "paused").length;
  if (pausedMailboxes > 0 && activeMailboxes === 0) {
    issues.push({ level: "critical", label: "Mailboxes", detail: `All ${pausedMailboxes} sending mailbox(es) are paused.`, recommendation: "Reconnect or resume a mailbox before sending." });
  }

  const critical = issues.filter((i) => i.level === "critical").length;
  const warning = issues.filter((i) => i.level === "warning").length;
  const score = Math.max(0, 100 - critical * 25 - warning * 8);

  return { score, issues };
}
