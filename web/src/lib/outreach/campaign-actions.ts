// Reusable campaign automation actions — shared by the hard-coded reply
// handlers, the Leads bulk actions, and the configurable Subsequences engine so
// there's one implementation of each. SERVER-ONLY.
import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resend } from "@/lib/resend";
import { emailFromName, wrapEmail } from "@/lib/email-utils";
import { getOrCreateIntakePool } from "@/lib/enterprise-intake-inbox";
import { renderTemplate, firstName, type CampaignVars } from "@/lib/campaigns";

// Create an ATS application for a candidate (on the job they were sourced for,
// or the intake pool), deduped by org + email. Returns the application id.
export async function moveEmailToPipeline(orgId: string, email: string, name: string | null, actingUser = "reply-agent"): Promise<string | null> {
  const lower = email.toLowerCase();
  const { data: existing } = await supabaseAdmin
    .from("enterprise_applications").select("id").eq("org_id", orgId).ilike("candidate_email", lower).limit(1).maybeSingle();
  if (existing?.id) return (existing as { id: string }).id;

  const { data: enr } = await supabaseAdmin
    .from("enterprise_campaign_enrollments").select("job_id").eq("org_id", orgId).ilike("candidate_email", lower)
    .order("enrolled_at", { ascending: false }).limit(1).maybeSingle();
  let jobId = (enr as { job_id: string | null } | null)?.job_id ?? null;
  if (!jobId) jobId = await getOrCreateIntakePool(orgId, actingUser);
  if (!jobId) return null;

  const { data: app } = await supabaseAdmin
    .from("enterprise_applications")
    .insert({ org_id: orgId, job_id: jobId, candidate_name: name?.trim() || lower.split("@")[0], candidate_email: lower, source: "jobsai", stage: "applied" })
    .select("id").single();
  return (app as { id: string } | null)?.id ?? null;
}

// Email the org's owners/admins/recruiters. Best-effort.
export async function notifyRecruiters(orgId: string, subject: string, bodyHtml: string): Promise<boolean> {
  const { data: org } = await supabaseAdmin.from("enterprise_orgs").select("name, white_label_email_from").eq("id", orgId).maybeSingle();
  const orgName = (org as { name?: string } | null)?.name ?? "Recruiting";
  const { data: members } = await supabaseAdmin
    .from("enterprise_members").select("user_id").eq("org_id", orgId).in("role", ["owner", "admin", "recruiter"]).limit(25);
  const userIds = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);
  if (!userIds.length) return false;
  const clerk = await clerkClient();
  const emails = await Promise.all(userIds.map(async (uid) => {
    try { return (await clerk.users.getUser(uid)).emailAddresses[0]?.emailAddress ?? null; } catch { return null; }
  }));
  const to = [...new Set(emails.filter((e): e is string => !!e))];
  if (!to.length) return false;
  const fromName = emailFromName(orgName, (org as { white_label_email_from?: string | null } | null)?.white_label_email_from ?? null);
  await resend.emails.send({
    from: `${fromName} <support@jobsai.work>`,
    to,
    subject,
    html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">${bodyHtml}</div>`,
  }).catch(() => {});
  return true;
}

// Enroll a candidate into another campaign (dedup by campaign + email). Returns
// the enrollment id, or null when it can't (no email, no step, already in it).
export async function enrollInCampaign(orgId: string, targetCampaignId: string, email: string, name: string | null, enrolledBy: string): Promise<string | null> {
  const lower = email.toLowerCase();
  const { data: campaign } = await supabaseAdmin
    .from("enterprise_campaigns").select("id, status").eq("id", targetCampaignId).eq("org_id", orgId).maybeSingle();
  if (!campaign) return null;
  const { data: steps } = await supabaseAdmin
    .from("enterprise_campaign_steps").select("delay_days").eq("campaign_id", targetCampaignId).order("step_order", { ascending: true }).limit(1);
  if (!steps || steps.length === 0) return null;

  const { data: existing } = await supabaseAdmin
    .from("enterprise_campaign_enrollments").select("id").eq("campaign_id", targetCampaignId).ilike("candidate_email", lower).maybeSingle();
  if (existing?.id) return (existing as { id: string }).id;

  const nextSendAt = new Date(Date.now() + Math.max(0, steps[0].delay_days || 0) * 86_400_000).toISOString();
  const { data: enrollment } = await supabaseAdmin
    .from("enterprise_campaign_enrollments")
    .insert({ campaign_id: targetCampaignId, org_id: orgId, candidate_name: name ?? lower.split("@")[0], candidate_email: lower, candidate_source: "subsequence", status: "active", current_step_order: 0, next_send_at: nextSendAt, enrolled_by: enrolledBy })
    .select("id").single();
  return (enrollment as { id: string } | null)?.id ?? null;
}

// Send a one-off email to a candidate (white-label, from the org's default
// sender). Subject/body support the standard {{vars}}. Best-effort — returns
// whether it sent. Used by the send_email subsequence action.
export async function sendOneOffEmail(orgId: string, email: string, name: string | null, subject: string, body: string): Promise<boolean> {
  if (!subject.trim() || !body.trim()) return false;
  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs").select("name, show_powered_by, white_label_email_from").eq("id", orgId).maybeSingle();
  const orgName = (org as { name?: string } | null)?.name ?? "Recruiting";
  const showPoweredBy = (org as { show_powered_by?: boolean } | null)?.show_powered_by ?? true;
  const fromName = emailFromName(orgName, (org as { white_label_email_from?: string | null } | null)?.white_label_email_from ?? null);
  const vars: CampaignVars = {
    candidate_name: name ?? email.split("@")[0],
    first_name: firstName(name ?? email.split("@")[0]),
    job_title: "our open role",
    org_name: orgName,
    sender_name: `${orgName} Recruiting`,
  };
  const html = wrapEmail(`<p>${renderTemplate(body, vars).replace(/\n/g, "<br>")}</p>`, showPoweredBy);
  try {
    await resend.emails.send({ from: `${fromName} <support@jobsai.work>`, to: email, subject: renderTemplate(subject, vars), html });
    return true;
  } catch {
    return false;
  }
}

// Append a tag to the candidate's application(s) in the org (deduped). Best-
// effort — returns how many rows were tagged (0 if the candidate has no
// application yet). Used by the add_tag subsequence action.
export async function addTagToCandidate(orgId: string, email: string, tag: string): Promise<number> {
  const clean = tag.trim();
  if (!clean) return 0;
  const { data: apps } = await supabaseAdmin
    .from("enterprise_applications").select("id, tags").eq("org_id", orgId).ilike("candidate_email", email.toLowerCase());
  const rows = (apps ?? []) as { id: string; tags: string[] | null }[];
  let tagged = 0;
  for (const app of rows) {
    const tags = app.tags ?? [];
    if (tags.includes(clean)) continue;
    const { error } = await supabaseAdmin.from("enterprise_applications").update({ tags: [...tags, clean] }).eq("id", app.id).eq("org_id", orgId);
    if (!error) tagged++;
  }
  return tagged;
}
