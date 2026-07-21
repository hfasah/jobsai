import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// Weekly consumer health sweep (Mondays 07:00 UTC). Every check measures
// OUTCOMES, not cron completion: the 2026-07 incident week proved a cron can
// report success while starving every user. Findings land in
// platform_health_reports/_findings (admin portal Health page); an alert email
// goes out only when something is warn/critical.

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

  // ── 1. Discovery pulse: imports per day (the drought detector) ─────────────
  try {
    const { data: jobs, error } = await supabaseAdmin
      .from("jobs").select("created_at").gte("created_at", since7d).limit(10000);
    if (error) throw new Error(error.message);
    const byDay = new Map<string, number>();
    for (const j of jobs ?? []) {
      const d = String(j.created_at).slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    const total = jobs?.length ?? 0;
    const { count: prefsUsers } = await supabaseAdmin
      .from("user_preferences").select("user_id", { count: "exact", head: true })
      .not("job_titles", "eq", "{}");
    const last3daysZero = [1, 2, 3].every((n) => {
      const d = new Date(Date.now() - n * DAY).toISOString().slice(0, 10);
      return (byDay.get(d) ?? 0) === 0;
    });
    if (last3daysZero) {
      findings.push({ severity: "critical", area: "discovery", title: "No jobs imported for 3+ days", detail: "The discover pipeline is starving users again. Check /api/admin/discovery-probe.", metric: { imports_7d: total } });
    } else if (total === 0) {
      findings.push({ severity: "critical", area: "discovery", title: "Zero jobs imported in 7 days", metric: { imports_7d: 0 } });
    } else {
      findings.push({ severity: "ok", area: "discovery", title: `${total} jobs imported in the last 7 days`, metric: { imports_7d: total, users_with_prefs: prefsUsers ?? 0, by_day: Object.fromEntries(byDay) } });
    }
  } catch (e) {
    findings.push({ severity: "warn", area: "discovery", title: "Discovery check failed to run", detail: e instanceof Error ? e.message : String(e) });
  }

  // ── 2. Auto-apply pulse: outcomes + stuck tasks ────────────────────────────
  try {
    const { data: attempts, error } = await supabaseAdmin
      .from("apply_attempts").select("status, created_at").gte("created_at", since7d).limit(10000);
    if (error) throw new Error(error.message);
    const by: Record<string, number> = {};
    let stuck = 0;
    const now = Date.now();
    for (const a of attempts ?? []) {
      by[a.status] = (by[a.status] ?? 0) + 1;
      if (a.status === "pending" && now - new Date(a.created_at).getTime() > DAY) stuck++;
    }
    if (stuck > 0) {
      findings.push({ severity: "warn", area: "auto_apply", title: `${stuck} application(s) stuck in pending for over 24h`, detail: "Skyvern webhook may not be resolving tasks. The settlement sweep refunds non-submissions, but stuck tasks mean users see nothing happening.", metric: by });
    }
    if ((attempts?.length ?? 0) > 0 && (by["submitted"] ?? 0) === 0) {
      findings.push({ severity: "critical", area: "auto_apply", title: "Attempts exist but ZERO submitted in 7 days", metric: by });
    } else {
      findings.push({ severity: "ok", area: "auto_apply", title: `${by["submitted"] ?? 0} submitted / ${attempts?.length ?? 0} attempts in 7 days`, metric: by });
    }
    // Cron freshness: auto_apply_runs must have rows newer than 26h.
    const { data: lastRun } = await supabaseAdmin
      .from("auto_apply_runs").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!lastRun || now - new Date(lastRun.created_at).getTime() > 26 * 3_600_000) {
      findings.push({ severity: "critical", area: "crons", title: "Auto-apply cron has not produced a run log in 26h+", detail: "Check Vercel cron schedule and function logs on jobsai-web." });
    }
  } catch (e) {
    findings.push({ severity: "warn", area: "auto_apply", title: "Auto-apply check failed to run", detail: e instanceof Error ? e.message : String(e) });
  }

  // ── 3. Billing pulse: charge vs refund shape ───────────────────────────────
  try {
    const { data: ledger, error } = await supabaseAdmin
      .from("token_ledger").select("delta, reason").gte("created_at", since7d)
      .in("reason", ["auto_apply", "auto_apply_refund", "auto_apply_failed_refund", "auto_apply_meter_refund", "auto_apply_backfill_refund"]).limit(10000);
    if (error) throw new Error(error.message);
    let charged = 0, refunded = 0;
    for (const r of ledger ?? []) {
      if (r.reason === "auto_apply" && r.delta < 0) charged += -r.delta;
      if (r.delta > 0) refunded += r.delta;
    }
    const refundRate = charged > 0 ? refunded / charged : 0;
    if (charged > 0 && refundRate > 0.5) {
      findings.push({ severity: "warn", area: "billing", title: `High auto-apply refund rate: ${(refundRate * 100).toFixed(0)}%`, detail: "More than half of charged applications were refunded this week. Something upstream is failing often.", metric: { charged, refunded } });
    } else {
      findings.push({ severity: "ok", area: "billing", title: `Auto-apply credits: ${charged.toLocaleString()} charged, ${refunded.toLocaleString()} refunded (7d)`, metric: { charged, refunded } });
    }
  } catch (e) {
    findings.push({ severity: "warn", area: "billing", title: "Billing check failed to run", detail: e instanceof Error ? e.message : String(e) });
  }

  // ── 4. Email health: is the Resend key alive? ──────────────────────────────
  try {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      findings.push({ severity: "critical", area: "email", title: "RESEND_API_KEY is not configured" });
    } else {
      const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
      if (res.status === 401) findings.push({ severity: "critical", area: "email", title: "Resend API key is INVALID: all consumer emails are failing", detail: "Rotate RESEND_API_KEY on jobsai-web (this exact failure ran silently for weeks in July 2026)." });
      else if (!res.ok) findings.push({ severity: "warn", area: "email", title: `Resend API returned ${res.status}` });
      else findings.push({ severity: "ok", area: "email", title: "Resend API key valid" });
    }
  } catch (e) {
    findings.push({ severity: "warn", area: "email", title: "Email check failed to run", detail: e instanceof Error ? e.message : String(e) });
  }

  // ── 5. Stripe: open disputes are always critical ───────────────────────────
  try {
    const disputes = await getStripe().disputes.list({ limit: 20 });
    const open = disputes.data.filter((d) => ["needs_response", "warning_needs_response", "under_review"].includes(d.status));
    if (open.length > 0) {
      findings.push({ severity: "critical", area: "stripe", title: `${open.length} OPEN Stripe dispute(s) need attention`, detail: open.map((d) => `${d.id} · ${(d.amount / 100).toFixed(2)} ${d.currency.toUpperCase()} · ${d.status}`).join(" | "), metric: { count: open.length } });
    } else {
      findings.push({ severity: "ok", area: "stripe", title: "No open disputes" });
    }
  } catch (e) {
    findings.push({ severity: "warn", area: "stripe", title: "Stripe check failed to run", detail: e instanceof Error ? e.message : String(e) });
  }

  // ── Persist + alert ────────────────────────────────────────────────────────
  const status: Severity = findings.some((f) => f.severity === "critical") ? "critical"
    : findings.some((f) => f.severity === "warn") ? "warn" : "ok";

  const { data: report, error: reportError } = await supabaseAdmin
    .from("platform_health_reports")
    .insert({ platform: "consumer", status, summary: { counts: { critical: findings.filter((f) => f.severity === "critical").length, warn: findings.filter((f) => f.severity === "warn").length, ok: findings.filter((f) => f.severity === "ok").length } } })
    .select("id").single();
  if (reportError || !report) {
    console.error("[health] report insert failed:", reportError?.message);
    return NextResponse.json({ ok: false, status, findings }, { status: 500 });
  }
  const { error: findingsError } = await supabaseAdmin.from("platform_health_findings").insert(
    findings.map((f) => ({ report_id: report.id, severity: f.severity, area: f.area, title: f.title, detail: f.detail ?? null, metric: f.metric ?? {} }))
  );
  if (findingsError) console.error("[health] findings insert failed:", findingsError.message);

  // Email only when something needs a human (silent when all green).
  if (status !== "ok" && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const rows = findings.filter((f) => f.severity !== "ok")
      .map((f) => `<tr><td style="padding:6px 10px;font-weight:700;color:${f.severity === "critical" ? "#dc2626" : "#d97706"};">${f.severity.toUpperCase()}</td><td style="padding:6px 10px;"><strong>[${f.area}]</strong> ${f.title}${f.detail ? `<br><span style="color:#6b7280;font-size:12px;">${f.detail}</span>` : ""}</td></tr>`)
      .join("");
    const { error: mailError } = await resend.emails.send({
      from: process.env.NOTIFICATION_FROM_EMAIL ?? "JobsAI <notifications@jobsai.app>",
      to: ALERT_TO,
      subject: `⚠ JobsAI consumer health: ${status.toUpperCase()} (${findings.filter((f) => f.severity !== "ok").length} finding(s))`,
      html: `<h2 style="font-family:sans-serif;">Weekly consumer health sweep</h2><table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;">${rows}</table><p style="font-family:sans-serif;font-size:13px;">Full report: <a href="https://app.jobsai.work/admin/health">app.jobsai.work/admin/health</a></p>`,
    });
    if (mailError) console.error("[health] alert email failed:", mailError);
  }

  console.log("[cron/health]", { status, findings: findings.length });
  return NextResponse.json({ ok: true, status, findings });
}
