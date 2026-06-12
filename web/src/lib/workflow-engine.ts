import { supabaseAdmin } from "@/lib/supabase";
import { resend } from "@/lib/resend";
import { sendFromRecruiterGmail } from "@/lib/recruiter-gmail";
import { wrapEmail, emailFromName } from "@/lib/email-utils";
import type { AppStage } from "@/types/enterprise";

export type WorkflowTrigger =
  | "stage_change"
  | "application_created"
  | "offer_signed"
  | "offer_declined";

export interface WorkflowContext {
  org_id: string;
  org_name: string;
  // Application context (present for app triggers)
  application_id?: string;
  job_id?: string;
  job_title?: string;
  candidate_name?: string;
  candidate_email?: string;
  stage?: string;
  // Recruiter who triggered (for Gmail sending)
  recruiter_id?: string;
  // White-label email settings
  show_powered_by?: boolean;
  email_from_name?: string | null;
}

function interpolate(template: string, ctx: WorkflowContext): string {
  return template
    .replace(/\{\{name\}\}/gi, ctx.candidate_name ?? "")
    .replace(/\{\{candidate_name\}\}/gi, ctx.candidate_name ?? "")
    .replace(/\{\{job_title\}\}/gi, ctx.job_title ?? "")
    .replace(/\{\{org_name\}\}/gi, ctx.org_name)
    .replace(/\{\{stage\}\}/gi, ctx.stage ?? "");
}

export async function runWorkflows(
  trigger: WorkflowTrigger,
  ctx: WorkflowContext,
  triggerStage?: AppStage,
) {
  const { data: rules } = await supabaseAdmin
    .from("enterprise_workflow_rules")
    .select("*")
    .eq("org_id", ctx.org_id)
    .eq("active", true)
    .eq("trigger_type", trigger)
    .order("sort_order");

  if (!rules?.length) return;

  const matching = trigger === "stage_change"
    ? rules.filter((r) => !r.trigger_stage || r.trigger_stage === triggerStage)
    : rules;

  await Promise.allSettled(matching.map((rule) => executeAction(rule, ctx)));
}

async function executeAction(rule: Record<string, unknown>, ctx: WorkflowContext) {
  const cfg = (rule.action_config ?? {}) as Record<string, unknown>;

  switch (rule.action_type as string) {
    case "send_candidate_email": {
      if (!ctx.candidate_email) return;
      const subject = interpolate((cfg.subject as string) ?? "Update on your application", ctx);
      const bodyHtml = interpolate((cfg.body as string) ?? "<p>Hi {{name}},</p><p>We have an update on your application.</p>", ctx);
      const html = wrapEmail(bodyHtml, ctx.show_powered_by ?? true);
      const fromName = emailFromName(ctx.org_name, ctx.email_from_name);

      const gmailResult = ctx.recruiter_id
        ? await sendFromRecruiterGmail(ctx.recruiter_id, { to: ctx.candidate_email, subject, html }).catch(() => ({ ok: false }))
        : { ok: false };

      if (!gmailResult.ok) {
        await resend.emails.send({
          from: `${fromName} <support@jobsai.work>`,
          to: ctx.candidate_email,
          subject,
          html,
        }).catch(console.error);
      }
      break;
    }

    case "send_team_notification": {
      const emails = (cfg.notify_emails as string[]) ?? [];
      if (!emails.length) return;
      const message = interpolate(
        (cfg.message as string) ?? "{{candidate_name}} has been moved to {{stage}} for {{job_title}}.",
        ctx,
      );
      await resend.emails.send({
        from: `${ctx.org_name} Recruiting <support@jobsai.work>`,
        to: emails,
        subject: `[${ctx.org_name}] ${message.slice(0, 80)}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
          <h3 style="color:#2563eb">Recruiting Update</h3>
          <p>${message}</p>
          ${ctx.application_id ? `<p><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work"}/enterprise/jobs/${ctx.job_id}">View application →</a></p>` : ""}
        </div>`,
      }).catch(console.error);
      break;
    }

    case "assign_to": {
      const assignTo = cfg.user_id as string;
      if (!assignTo || !ctx.application_id) return;
      await supabaseAdmin
        .from("enterprise_applications")
        .update({ assigned_to: assignTo })
        .eq("id", ctx.application_id);
      break;
    }

    case "move_stage": {
      const toStage = cfg.stage as string;
      if (!toStage || !ctx.application_id) return;
      await supabaseAdmin
        .from("enterprise_applications")
        .update({ stage: toStage, stage_updated_at: new Date().toISOString() })
        .eq("id", ctx.application_id);
      break;
    }

    case "add_tag": {
      const tag = cfg.tag as string;
      if (!tag || !ctx.application_id) return;
      const { data: app } = await supabaseAdmin
        .from("enterprise_applications")
        .select("tags")
        .eq("id", ctx.application_id)
        .maybeSingle();
      if (!app) return;
      const tags: string[] = Array.isArray(app.tags) ? app.tags : [];
      if (!tags.includes(tag)) {
        await supabaseAdmin
          .from("enterprise_applications")
          .update({ tags: [...tags, tag] })
          .eq("id", ctx.application_id);
      }
      break;
    }
  }
}
