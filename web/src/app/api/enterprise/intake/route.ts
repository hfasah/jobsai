import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resend, FROM_SUPPORT, SUPPORT_EMAIL } from "@/lib/resend";
import { createRateLimiter, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { suggestPlan, type ToolPref } from "@/lib/enterprise-intake";

export const maxDuration = 20;

const limiter = createRateLimiter({ limit: 6, windowMs: 10 * 60_000 });

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work").replace(/\/$/, "");

// POST — public intake/lead form submission. Stores the lead, computes a
// suggested plan, and notifies the back office.
export async function POST(req: NextRequest) {
  const rl = limiter(getClientIp(req));
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const b = await req.json().catch(() => ({}));
  const company = (b.company as string | undefined)?.trim();
  const contact_name = (b.contact_name as string | undefined)?.trim();
  const contact_email = (b.contact_email as string | undefined)?.trim().toLowerCase();
  if (!company || !contact_name || !contact_email) {
    return NextResponse.json({ error: "Company, name, and email are required." }, { status: 400 });
  }

  const toolPrefs = (b.tool_prefs ?? {}) as Record<string, ToolPref>;
  const numRecruiters = b.num_recruiters != null && b.num_recruiters !== "" ? Math.max(0, Math.round(Number(b.num_recruiters))) : null;
  const suggestion = suggestPlan({ toolPrefs, numRecruiters, numEmployees: b.num_employees ?? null });

  const { data: row, error } = await supabaseAdmin
    .from("enterprise_intake")
    .insert({
      company,
      website: (b.website as string | undefined)?.trim() || null,
      contact_name,
      contact_email,
      contact_phone: (b.contact_phone as string | undefined)?.trim() || null,
      num_employees: b.num_employees ?? null,
      num_recruiters: numRecruiters,
      hiring_volume: b.hiring_volume ?? null,
      industry: (b.industry as string | undefined)?.trim() || null,
      current_tools: (b.current_tools as string | undefined)?.trim() || null,
      tool_prefs: toolPrefs,
      notes: (b.notes as string | undefined)?.trim() || null,
      suggested_plan: suggestion.slug,
      status: "new",
    })
    .select("id")
    .single();

  if (error || !row) {
    console.error("enterprise_intake insert error", error);
    return NextResponse.json({ error: "Could not submit the form." }, { status: 500 });
  }

  const needs = Object.entries(toolPrefs).filter(([, v]) => v === "need").length;
  const wants = Object.entries(toolPrefs).filter(([, v]) => v === "want").length;

  // Notify the back office (best-effort).
  resend.emails.send({
    from: FROM_SUPPORT,
    to: SUPPORT_EMAIL,
    replyTo: contact_email,
    subject: `New enterprise lead — ${company} (suggested: ${suggestion.label})`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#6d28d9">New enterprise intake</h2>
        <p><strong>${company}</strong>${b.website ? ` · ${b.website}` : ""}</p>
        <p>${contact_name} &lt;${contact_email}&gt;${b.contact_phone ? ` · ${b.contact_phone}` : ""}</p>
        <p>Employees: ${b.num_employees ?? "—"} · Recruiter seats: ${numRecruiters ?? "—"} · Hiring: ${b.hiring_volume ?? "—"}</p>
        <p><strong>Suggested plan: ${suggestion.label}</strong> · ${needs} needs, ${wants} wants</p>
        <p><a href="${APP_URL}/admin/enterprise/intake" style="color:#6d28d9">Review & create the account →</a></p>
      </div>`,
  }).then(() => {}, (e) => console.error("intake admin email", e));

  // Acknowledge the prospect (best-effort).
  resend.emails.send({
    from: FROM_SUPPORT,
    to: contact_email,
    replyTo: SUPPORT_EMAIL,
    subject: `Thanks, ${contact_name.split(/\s+/)[0]} — we got your JobsAI Enterprise request`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#0f172a;font-size:15px;line-height:1.6">
        <p>Hi ${contact_name.split(/\s+/)[0]},</p>
        <p>Thanks for sharing your needs for <strong>${company}</strong>. Our team will review and follow up shortly with a tailored setup — likely on the <strong>${suggestion.label}</strong> plan based on what you selected.</p>
        <p>Talk soon,<br/>The JobsAI Enterprise team</p>
      </div>`,
  }).then(() => {}, (e) => console.error("intake ack email", e));

  return NextResponse.json({ ok: true, suggested: suggestion });
}
