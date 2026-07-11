// Campaign launch preflight — deterministic checks surfaced BEFORE a campaign
// goes live, so recruiters can't torch a domain by accident. Advisory in O1
// (UI shows failures); O2 hard-gates activation on `ok`. SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";
import { renderTemplate, CAMPAIGN_VARS, type CampaignVars } from "@/lib/campaigns";
import { effectiveDailyLimit, type MailboxRow } from "./deliverability";
import { isUsableStatus } from "./resend-domains";

export interface PreflightCheck {
  key: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

export interface PreflightResult {
  ok: boolean; // no 'fail' checks
  checks: PreflightCheck[];
}

const UNRESOLVED_VAR = /\{\{\s*[\w.]+\s*\}\}/;

export async function preflightCampaign(orgId: string, campaignId: string): Promise<PreflightResult> {
  const checks: PreflightCheck[] = [];

  // Ownership gate first — enterprise_campaign_steps has no org_id column, so
  // tenant isolation for steps flows through the campaign row.
  const { data: campaign } = await supabaseAdmin
    .from("enterprise_campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!campaign) {
    return { ok: false, checks: [{ key: "campaign", label: "Campaign", status: "fail", detail: "Campaign not found." }] };
  }

  const [{ data: steps }, { data: enrollments }, { data: mailboxes }, { data: domains }, { data: org }] = await Promise.all([
    supabaseAdmin
      .from("enterprise_campaign_steps")
      .select("id, subject, body, delay_days")
      .eq("campaign_id", campaignId)
      .order("step_order", { ascending: true }),
    supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .select("id", { count: "exact", head: false })
      .eq("campaign_id", campaignId)
      .eq("org_id", orgId)
      .in("status", ["active", "pending"])
      .limit(1000),
    supabaseAdmin
      .from("sending_mailboxes")
      .select("id, org_id, kind, address, status, paused_reason, ramp_started_at, daily_limit_cap")
      .eq("org_id", orgId),
    supabaseAdmin
      .from("sending_domains")
      .select("id, domain, status")
      .eq("org_id", orgId),
    supabaseAdmin
      .from("enterprise_orgs")
      .select("reply_to_email, intake_email_handle")
      .eq("id", orgId)
      .maybeSingle(),
  ]);

  // 1. Steps exist and templates are sane
  const stepRows = (steps ?? []) as { id: string; subject: string | null; body: string | null; delay_days: number | null }[];
  if (stepRows.length === 0) {
    checks.push({ key: "steps", label: "Sequence steps", status: "fail", detail: "The campaign has no steps." });
  } else {
    checks.push({ key: "steps", label: "Sequence steps", status: "pass", detail: `${stepRows.length} step${stepRows.length !== 1 ? "s" : ""}.` });
    // 2. Variables resolve against a fully-populated sample candidate
    const sample: CampaignVars = Object.fromEntries(CAMPAIGN_VARS.map((v) => [v, "sample"])) as CampaignVars;
    const broken = stepRows.filter((s) => {
      const rendered = renderTemplate(`${s.subject ?? ""}\n${s.body ?? ""}`, sample);
      return UNRESOLVED_VAR.test(rendered);
    });
    checks.push(
      broken.length > 0
        ? { key: "variables", label: "Template variables", status: "fail", detail: `${broken.length} step(s) contain variables that will not resolve.` }
        : { key: "variables", label: "Template variables", status: "pass", detail: "All template variables resolve." },
    );
    // 3. Empty subject/body
    const empty = stepRows.filter((s) => !(s.subject ?? "").trim() || !(s.body ?? "").trim());
    checks.push(
      empty.length > 0
        ? { key: "content", label: "Step content", status: "fail", detail: `${empty.length} step(s) have an empty subject or body.` }
        : { key: "content", label: "Step content", status: "pass", detail: "Every step has a subject and body." },
    );
  }

  // 4. Non-empty audience
  const enrolled = (enrollments ?? []).length;
  checks.push(
    enrolled === 0
      ? { key: "audience", label: "Audience", status: "fail", detail: "No candidates are enrolled." }
      : { key: "audience", label: "Audience", status: "pass", detail: `${enrolled} candidate${enrolled !== 1 ? "s" : ""} enrolled.` },
  );

  // 5. Sending identity: a usable org domain mailbox, or a connected personal
  //    mailbox. Cold volume from the shared platform domain is a warn — allowed
  //    for small nurture sends, discouraged for cold outreach.
  const mailboxRows = (mailboxes ?? []) as MailboxRow[];
  const domainRows = (domains ?? []) as { id: string; domain: string; status: string }[];
  const activeMailboxes = mailboxRows.filter((m) => m.status === "active");
  const usableDomain = domainRows.some((d) => isUsableStatus(d.status));
  if (activeMailboxes.length > 0 && usableDomain) {
    checks.push({ key: "identity", label: "Sending identity", status: "pass", detail: `${activeMailboxes.length} active mailbox(es) on a verified domain.` });
  } else if (activeMailboxes.some((m) => m.kind === "gmail" || m.kind === "microsoft")) {
    checks.push({ key: "identity", label: "Sending identity", status: "pass", detail: "Sending via a connected personal mailbox." });
  } else if (domainRows.length > 0 && !usableDomain) {
    checks.push({ key: "identity", label: "Sending identity", status: "fail", detail: "Your sending domain is not verified yet — finish DNS setup." });
  } else {
    checks.push({ key: "identity", label: "Sending identity", status: "warn", detail: "No org sending domain configured — mail will use the shared JobsAI address. Fine for small nurture sends; set up your own domain for cold outreach." });
  }

  // 6. Daily load vs today's ramp capacity
  if (enrolled > 0 && activeMailboxes.length > 0) {
    const capacity = activeMailboxes.reduce((sum, m) => sum + effectiveDailyLimit(m.ramp_started_at, m.daily_limit_cap), 0);
    checks.push(
      enrolled > capacity
        ? { key: "capacity", label: "Daily capacity", status: "warn", detail: `${enrolled} enrolled vs ~${capacity}/day mailbox capacity — the first step will spread across days.` }
        : { key: "capacity", label: "Daily capacity", status: "pass", detail: `~${capacity} sends/day available across mailboxes.` },
    );
  }

  // 7. Reply routing (replies must land back in the system)
  const orgRow = org as { reply_to_email?: string | null; intake_email_handle?: string | null } | null;
  checks.push(
    orgRow?.reply_to_email || orgRow?.intake_email_handle
      ? { key: "replies", label: "Reply routing", status: "pass", detail: "Replies route back into JobsAI." }
      : { key: "replies", label: "Reply routing", status: "warn", detail: "No reply-to/intake address configured — replies may be lost." },
  );

  return { ok: !checks.some((c) => c.status === "fail"), checks };
}
