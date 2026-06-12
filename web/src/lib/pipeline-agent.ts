import { supabaseAdmin } from "@/lib/supabase";
import { resend } from "@/lib/resend";

export interface AgentApplication {
  id: string;
  org_id: string;
  job_id: string;
  candidate_name: string;
  candidate_email: string;
  stage: string;
  match_score: number | null;
  ats_score: number | null;
  ai_recommendation: string | null;
  risk_flags: string[] | null;
  ats_keywords_matched: string[] | null;
  ats_keywords_missing: string[] | null;
}

interface Condition {
  field: string;
  operator: string;
  value: unknown;
}

interface Rule {
  id: string;
  name: string;
  job_id: string | null;
  trigger_event: string;
  conditions: Condition[];
  action: string;
  action_config: Record<string, unknown>;
}

function evaluateCondition(cond: Condition, app: AgentApplication): boolean {
  const raw = (app as unknown as Record<string, unknown>)[cond.field];

  switch (cond.operator) {
    case "gte":   return typeof raw === "number" && raw >= (cond.value as number);
    case "lte":   return typeof raw === "number" && raw <= (cond.value as number);
    case "gt":    return typeof raw === "number" && raw > (cond.value as number);
    case "lt":    return typeof raw === "number" && raw < (cond.value as number);
    case "eq":    return raw === cond.value;
    case "neq":   return raw !== cond.value;
    case "in":    return Array.isArray(cond.value) && (cond.value as unknown[]).includes(raw);
    case "not_in": return Array.isArray(cond.value) && !(cond.value as unknown[]).includes(raw);
    case "contains_all": {
      const arr = Array.isArray(raw) ? (raw as string[]) : [];
      const required = Array.isArray(cond.value) ? (cond.value as string[]) : [];
      return required.every((v) => arr.some((a) => a.toLowerCase().includes(v.toLowerCase())));
    }
    case "contains_any": {
      const arr = Array.isArray(raw) ? (raw as string[]) : [];
      const any = Array.isArray(cond.value) ? (cond.value as string[]) : [];
      return any.some((v) => arr.some((a) => a.toLowerCase().includes(v.toLowerCase())));
    }
    case "is_empty":
      return !raw || (Array.isArray(raw) && raw.length === 0);
    case "not_empty":
      return !!raw && !(Array.isArray(raw) && raw.length === 0);
    default:
      return false;
  }
}

function evaluateRule(rule: Rule, app: AgentApplication): boolean {
  const conditions = Array.isArray(rule.conditions) ? rule.conditions : [];
  if (conditions.length === 0) return false;
  return conditions.every((c) => evaluateCondition(c, app));
}

async function executeAction(rule: Rule, app: AgentApplication, jobTitle: string): Promise<{ result: string; details: Record<string, unknown> }> {
  const cfg = rule.action_config;

  switch (rule.action) {
    case "move_stage": {
      const stage = cfg.stage as string;
      if (!stage) return { result: "error", details: { reason: "No stage configured" } };
      // Don't downgrade
      const ORDER = ["applied", "screened", "interview", "offer", "hired"];
      const currentIdx = ORDER.indexOf(app.stage);
      const targetIdx = ORDER.indexOf(stage);
      if (targetIdx <= currentIdx) return { result: "skipped", details: { reason: "Already at or past this stage" } };

      await supabaseAdmin
        .from("enterprise_applications")
        .update({ stage, stage_updated_at: new Date().toISOString() })
        .eq("id", app.id);
      return { result: "success", details: { stage } };
    }

    case "auto_reject": {
      await supabaseAdmin
        .from("enterprise_applications")
        .update({ stage: "rejected", stage_updated_at: new Date().toISOString() })
        .eq("id", app.id);

      // Optional rejection email
      if (cfg.send_email && app.candidate_email) {
        const orgRes = await supabaseAdmin.from("enterprise_orgs").select("name").eq("id", app.org_id).maybeSingle();
        const orgName = orgRes.data?.name ?? "The hiring team";
        await resend.emails.send({
          from: `${orgName} <support@jobsai.work>`,
          to: app.candidate_email,
          subject: `Your application for ${jobTitle}`,
          html: `<div style="font-family:sans-serif;max-width:560px;color:#0f172a">
            <p>Hi ${app.candidate_name},</p>
            <p>Thank you for applying for the <strong>${jobTitle}</strong> role. After reviewing your application, we've decided to move forward with other candidates whose experience more closely matches our current needs.</p>
            <p>We appreciate your interest and encourage you to apply for future openings.</p>
            <p>Best regards,<br/>${orgName}</p>
          </div>`,
        }).catch(() => {});
      }
      return { result: "success", details: { stage: "rejected", email_sent: !!(cfg.send_email && app.candidate_email) } };
    }

    case "add_tag": {
      const tag = cfg.tag as string;
      if (!tag) return { result: "error", details: { reason: "No tag configured" } };
      const { data: current } = await supabaseAdmin
        .from("enterprise_applications").select("tags").eq("id", app.id).maybeSingle();
      const tags: string[] = current?.tags ?? [];
      if (!tags.includes(tag)) {
        await supabaseAdmin.from("enterprise_applications").update({ tags: [...tags, tag] }).eq("id", app.id);
      }
      return { result: "success", details: { tag } };
    }

    case "notify_hm": {
      // Get job's hiring manager
      const { data: job } = await supabaseAdmin
        .from("enterprise_jobs").select("hiring_manager_id,title").eq("id", app.job_id).maybeSingle();

      if (!job?.hiring_manager_id) return { result: "skipped", details: { reason: "No hiring manager assigned" } };

      const { clerkClient } = await import("@clerk/nextjs/server");
      const clerk = await clerkClient();
      let hmEmail = "";
      try {
        const user = await clerk.users.getUser(job.hiring_manager_id);
        hmEmail = user.emailAddresses[0]?.emailAddress ?? "";
      } catch { return { result: "error", details: { reason: "Could not fetch HM email" } }; }

      if (!hmEmail) return { result: "skipped", details: { reason: "No HM email" } };

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";
      await resend.emails.send({
        from: `JobsAI Agent <support@jobsai.work>`,
        to: hmEmail,
        subject: `🤖 Strong candidate for ${jobTitle}: ${app.candidate_name}`,
        html: `<div style="font-family:sans-serif;max-width:560px;color:#0f172a">
          <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);border-radius:8px;padding:16px 20px;margin-bottom:20px">
            <p style="margin:0;color:#fff;font-weight:600">Recruiting Agent Alert</p>
          </div>
          <p>Hi,</p>
          <p>The recruiting agent flagged a strong candidate for your review:</p>
          <table style="width:100%;border-collapse:collapse;margin:12px 0">
            <tr><td style="padding:4px 0;color:#64748b;font-size:13px">Candidate</td><td style="padding:4px 0;font-weight:600">${app.candidate_name}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;font-size:13px">Role</td><td style="padding:4px 0">${jobTitle}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;font-size:13px">Match score</td><td style="padding:4px 0;font-weight:600;color:#16a34a">${app.match_score ?? "—"}%</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;font-size:13px">AI recommendation</td><td style="padding:4px 0">${app.ai_recommendation ?? "—"}</td></tr>
          </table>
          <p><a href="${appUrl}/enterprise/hiring-manager" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">Review in workspace →</a></p>
        </div>`,
      }).catch(() => {});

      return { result: "success", details: { hm_email: hmEmail } };
    }

    case "send_interview_invite": {
      // Send the AI interview link
      const { data: inviteData } = await supabaseAdmin
        .from("enterprise_interviews")
        .select("id,token")
        .eq("application_id", app.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!inviteData?.token) {
        return { result: "skipped", details: { reason: "No interview token found — screen with AI Interview first" } };
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";
      const orgRes = await supabaseAdmin.from("enterprise_orgs").select("name").eq("id", app.org_id).maybeSingle();
      const orgName = orgRes.data?.name ?? "The hiring team";

      await resend.emails.send({
        from: `${orgName} <support@jobsai.work>`,
        to: app.candidate_email,
        subject: `Interview invitation: ${jobTitle}`,
        html: `<div style="font-family:sans-serif;max-width:560px;color:#0f172a">
          <p>Hi ${app.candidate_name},</p>
          <p>Congratulations! We were impressed with your application for <strong>${jobTitle}</strong> and would like to invite you to a short AI-powered interview.</p>
          <p>The interview takes about 15–20 minutes and you can complete it at your convenience.</p>
          <p style="margin:20px 0"><a href="${appUrl}/interview/${inviteData.token}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Start your interview →</a></p>
          <p style="color:#64748b;font-size:13px">Best regards,<br/>${orgName}</p>
        </div>`,
      }).catch(() => {});

      return { result: "success", details: { interview_token: inviteData.token } };
    }

    default:
      return { result: "error", details: { reason: `Unknown action: ${rule.action}` } };
  }
}

export async function runPipelineAgent(app: AgentApplication, jobTitle: string): Promise<void> {
  // Load active rules for this org (org-wide + job-specific)
  const { data: rules } = await supabaseAdmin
    .from("enterprise_pipeline_rules")
    .select("*")
    .eq("org_id", app.org_id)
    .eq("active", true)
    .eq("trigger_event", "application_screened")
    .or(`job_id.is.null,job_id.eq.${app.job_id}`)
    .order("created_at");

  if (!rules?.length) return;

  const fired: string[] = [];

  for (const rule of rules) {
    if (!evaluateRule(rule as Rule, app)) continue;
    if (fired.includes(rule.action)) continue; // one action per type per run

    const { result, details } = await executeAction(rule as Rule, app, jobTitle);

    // Log the action
    await supabaseAdmin.from("enterprise_agent_actions").insert({
      org_id: app.org_id,
      rule_id: rule.id,
      rule_name: rule.name,
      application_id: app.id,
      candidate_name: app.candidate_name,
      job_title: jobTitle,
      action: rule.action,
      result,
      details,
    });

    // Increment run count
    void supabaseAdmin
      .from("enterprise_pipeline_rules")
      .update({ run_count: (rule.run_count ?? 0) + 1 })
      .eq("id", rule.id);

    if (result === "success") fired.push(rule.action);

    // Re-fetch app state after stage moves (so subsequent rules see the updated stage)
    if (rule.action === "move_stage" && result === "success") {
      const { data: refreshed } = await supabaseAdmin
        .from("enterprise_applications")
        .select("stage")
        .eq("id", app.id)
        .maybeSingle();
      if (refreshed) app.stage = refreshed.stage;
    }
  }
}
