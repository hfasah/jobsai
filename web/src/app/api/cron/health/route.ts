import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resend } from "@/lib/resend";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// Weekly enterprise health sweep (Mondays 07:30 UTC): outcome checks for the
// recruiter platform, written to the shared platform_health tables (mig 183)
// and shown on /admin/health. Alert email only when warn/critical.

type Severity = "ok" | "warn" | "critical";
interface Finding { severity: Severity; area: string; title: string; detail?: string; metric?: Record<string, unknown> }

const DAY = 86_400_000;
const ALERT_TO = process.env.ADMIN_ALERT_EMAIL ?? "everybrainai@gmail.com";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const findings: Finding[] = [];
  const since7d = new Date(Date.now() - 7 * DAY).toISOString();

  // ── 1. Outreach pulse: are active campaigns actually sending? ──────────────
  try {
    const [{ data: activeCampaigns, error: cErr }, { data: msgs, error: mErr }] = await Promise.all([
      supabaseAdmin.from("enterprise_campaigns").select("id, org_id").eq("status", "active"),
      supabaseAdmin.from("enterprise_messages").select("direction").gte("created_at", since7d).limit(10000),
    ]);
    if (cErr) throw new Error(cErr.message);
    if (mErr) throw new Error(mErr.message);
    const outbound = (msgs ?? []).filter((m) => m.direction === "outbound").length;
    const inbound = (msgs ?? []).filter((m) => m.direction === "inbound").length;
    if ((activeCampaigns?.length ?? 0) > 0 && outbound === 0) {
      findings.push({ severity: "critical", area: "campaigns", title: `${activeCampaigns!.length} active campaign(s) but ZERO outbound messages in 7 days`, detail: "The campaign engine may be stalled. Check /api/cron/enterprise-campaigns logs.", metric: { active: activeCampaigns!.length } });
    } else {
      findings.push({ severity: "ok", area: "campaigns", title: `${outbound} sent / ${inbound} received in 7 days (${activeCampaigns?.length ?? 0} active campaigns)`, metric: { outbound, inbound, active_campaigns: activeCampaigns?.length ?? 0 } });
    }
  } catch (e) {
    findings.push({ severity: "warn", area: "campaigns", title: "Outreach check failed to run", detail: e instanceof Error ? e.message : String(e) });
  }

  // ── 2. Support: tickets open with no reply for 48h+ ────────────────────────
  try {
    const cutoff = new Date(Date.now() - 2 * DAY).toISOString();
    const { data: stale, error } = await supabaseAdmin
      .from("support_tickets").select("id, email, created_at")
      .eq("status", "open").is("replied_at", null).lt("created_at", cutoff).limit(50);
    if (error) throw new Error(error.message);
    if ((stale?.length ?? 0) > 0) {
      findings.push({ severity: "warn", area: "support", title: `${stale!.length} support ticket(s) unanswered for 48h+`, detail: stale!.slice(0, 5).map((t) => t.email).join(", "), metric: { count: stale!.length } });
    } else {
      findings.push({ severity: "ok", area: "support", title: "No support tickets waiting over 48h" });
    }
  } catch (e) {
    findings.push({ severity: "warn", area: "support", title: "Support check failed to run", detail: e instanceof Error ? e.message : String(e) });
  }

  // ── 3. Candidate flow: new applications reaching orgs ──────────────────────
  try {
    const { count, error } = await supabaseAdmin
      .from("enterprise_applications").select("id", { count: "exact", head: true }).gte("created_at", since7d);
    if (error) throw new Error(error.message);
    findings.push({ severity: "ok", area: "candidates", title: `${count ?? 0} new candidate application(s) in 7 days`, metric: { new_applications_7d: count ?? 0 } });
  } catch (e) {
    findings.push({ severity: "warn", area: "candidates", title: "Candidate-flow check failed to run", detail: e instanceof Error ? e.message : String(e) });
  }

  // ── 4. Email health: enterprise Resend key probe ───────────────────────────
  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) findings.push({ severity: "critical", area: "email", title: "RESEND_API_KEY is not configured on jobsai-enterprise" });
    else {
      const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
      if (res.status === 401) findings.push({ severity: "critical", area: "email", title: "Enterprise Resend API key is INVALID: outreach + support emails are failing" });
      else if (!res.ok) findings.push({ severity: "warn", area: "email", title: `Resend API returned ${res.status}` });
      else findings.push({ severity: "ok", area: "email", title: "Resend API key valid" });
    }
  } catch (e) {
    findings.push({ severity: "warn", area: "email", title: "Email check failed to run", detail: e instanceof Error ? e.message : String(e) });
  }

  // ── Persist + alert ────────────────────────────────────────────────────────
  const status: Severity = findings.some((f) => f.severity === "critical") ? "critical"
    : findings.some((f) => f.severity === "warn") ? "warn" : "ok";

  const { data: report, error: reportError } = await supabaseAdmin
    .from("platform_health_reports")
    .insert({ platform: "enterprise", status, summary: { counts: { critical: findings.filter((f) => f.severity === "critical").length, warn: findings.filter((f) => f.severity === "warn").length, ok: findings.filter((f) => f.severity === "ok").length } } })
    .select("id").single();
  if (reportError || !report) {
    console.error("[health] report insert failed:", reportError?.message);
    return NextResponse.json({ ok: false, status, findings }, { status: 500 });
  }
  const { error: findingsError } = await supabaseAdmin.from("platform_health_findings").insert(
    findings.map((f) => ({ report_id: report.id, severity: f.severity, area: f.area, title: f.title, detail: f.detail ?? null, metric: f.metric ?? {} }))
  );
  if (findingsError) console.error("[health] findings insert failed:", findingsError.message);

  if (status !== "ok") {
    const rows = findings.filter((f) => f.severity !== "ok")
      .map((f) => `<tr><td style="padding:6px 10px;font-weight:700;color:${f.severity === "critical" ? "#dc2626" : "#d97706"};">${f.severity.toUpperCase()}</td><td style="padding:6px 10px;"><strong>[${f.area}]</strong> ${f.title}${f.detail ? `<br><span style="color:#6b7280;font-size:12px;">${f.detail}</span>` : ""}</td></tr>`)
      .join("");
    const { error: mailError } = await resend.emails.send({
      from: process.env.NOTIFICATION_FROM_EMAIL ?? "JobsAI <notifications@jobsai.app>",
      to: ALERT_TO,
      subject: `⚠ JobsAI enterprise health: ${status.toUpperCase()} (${findings.filter((f) => f.severity !== "ok").length} finding(s))`,
      html: `<h2 style="font-family:sans-serif;">Weekly enterprise health sweep</h2><table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;">${rows}</table><p style="font-family:sans-serif;font-size:13px;">Full report: <a href="https://app.jobsai.work/admin/health">app.jobsai.work/admin/health</a></p>`,
    });
    if (mailError) console.error("[health] alert email failed:", mailError);
  }

  console.log("[cron/health]", { status, findings: findings.length });
  return NextResponse.json({ ok: true, status, findings });
}
