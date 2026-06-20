import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { supabaseAdmin } from "@/lib/supabase";
import { resend } from "@/lib/resend";
import { wrapEmail, emailFromName } from "@/lib/email-utils";
import { recordUsage } from "@/lib/llm-usage";
import { renderTemplate, firstName, type CampaignVars } from "@/lib/campaigns";

export const maxDuration = 60;

let _ai: OpenAI | null = null;
const ai = () => (_ai ??= getAIClient(AI_TIERS.fast.provider));

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work";
const BATCH = 120;

// Daily cron. Walks every active enrollment whose next step is due, sends it,
// records a send row (for per-step analytics), and schedules the next step.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const { data: due } = await supabaseAdmin
    .from("enterprise_campaign_enrollments")
    .select("*, campaign:enterprise_campaigns(status), job:enterprise_jobs(title), org:enterprise_orgs(name, show_powered_by, white_label_email_from)")
    .eq("status", "active")
    .not("next_send_at", "is", null)
    .lte("next_send_at", now.toISOString())
    .order("next_send_at", { ascending: true })
    .limit(BATCH);

  if (!due || due.length === 0) return NextResponse.json({ ok: true, sent: 0 });

  // Load all steps for the campaigns in this batch, grouped by campaign.
  const campaignIds = [...new Set(due.map((e) => e.campaign_id))];
  const { data: allSteps } = await supabaseAdmin
    .from("enterprise_campaign_steps")
    .select("*")
    .in("campaign_id", campaignIds)
    .order("step_order", { ascending: true });
  const stepsByCampaign = new Map<string, typeof allSteps>();
  for (const s of allSteps ?? []) {
    const arr = stepsByCampaign.get(s.campaign_id) ?? [];
    arr.push(s);
    stepsByCampaign.set(s.campaign_id, arr);
  }

  let sent = 0;

  const processOne = async (e: Record<string, unknown>) => {
    const campaignStatus = (e.campaign as { status: string } | null)?.status;
    // Only send for live campaigns. Paused/draft enrollments wait (next_send_at
    // stays put, so they resume the moment the campaign goes active again).
    if (campaignStatus !== "active") return;

    const steps = stepsByCampaign.get(e.campaign_id as string) ?? [];
    const stepOrder = e.current_step_order as number;
    const step = steps.find((s) => s.step_order === stepOrder);

    // No such step → sequence is finished.
    if (!step) {
      await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .update({ status: "completed", next_send_at: null, completed_at: now.toISOString() })
        .eq("id", e.id as string);
      return;
    }

    const org = e.org as { name: string; show_powered_by: boolean; white_label_email_from: string | null } | null;
    const orgName = org?.name ?? "Recruiting";
    const fromName = emailFromName(orgName, org?.white_label_email_from ?? null);
    const showPoweredBy = org?.show_powered_by ?? true;
    const jobTitle = (e.job as { title: string } | null)?.title ?? "our open role";
    const candidateName = e.candidate_name as string;

    const vars: CampaignVars = {
      candidate_name: candidateName,
      first_name: firstName(candidateName),
      job_title: jobTitle,
      org_name: orgName,
      sender_name: `${orgName} Recruiting`,
    };

    let subject = renderTemplate(step.subject, vars);
    let bodyText = renderTemplate(step.body, vars);

    // Optional per-candidate AI rewrite — keeps the recruiter's intent, makes it personal.
    if (step.ai_personalize) {
      try {
        const resp = await ai().chat.completions.create({
          model: AI_TIERS.fast.model,
          temperature: 0.7,
          max_tokens: 400,
          response_format: { type: "json_object" },
          messages: [{
            role: "user",
            content: `Rewrite this recruiting outreach email to feel personal and natural for ${candidateName}, a candidate for the ${jobTitle} role at ${orgName}. Keep it short (under 120 words), warm, and human. Preserve the intent and any call to action. Do not invent specific facts about the candidate.${step.ai_prompt ? `\nExtra guidance: ${step.ai_prompt}` : ""}\n\nDraft subject: ${subject}\nDraft body:\n${bodyText}\n\nReturn JSON: { "subject": "...", "body": "..." }`,
          }],
        });
        const parsed = JSON.parse(resp.choices[0]?.message?.content ?? "{}");
        if (parsed.subject) subject = parsed.subject;
        if (parsed.body) bodyText = parsed.body;
        recordUsage({ orgId: e.org_id as string, feature: "campaign_step", model: AI_TIERS.fast.model, usage: { prompt_tokens: resp.usage?.prompt_tokens, completion_tokens: resp.usage?.completion_tokens } });
      } catch {
        // fall through to the rendered template
      }
    }

    // Insert the send row first so we have an id for the open-tracking pixel.
    const { data: send } = await supabaseAdmin
      .from("enterprise_campaign_sends")
      .insert({
        enrollment_id: e.id as string,
        campaign_id: e.campaign_id as string,
        step_id: step.id,
        step_order: stepOrder,
        org_id: e.org_id as string,
        candidate_email: e.candidate_email as string,
        subject,
      })
      .select("id")
      .single();

    const pixel = send ? `<img src="${BASE_URL}/api/enterprise/campaigns/track?s=${send.id}" width="1" height="1" alt="" style="display:none"/>` : "";
    const html = wrapEmail(`<p>${bodyText.replace(/\n/g, "<br>")}</p>${pixel}`, showPoweredBy);

    try {
      await resend.emails.send({
        from: `${fromName} <support@jobsai.work>`,
        to: e.candidate_email as string,
        subject,
        html,
      });
    } catch {
      // Leave the send row; mark enrollment bounced so it doesn't retry forever.
      await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .update({ status: "bounced", next_send_at: null })
        .eq("id", e.id as string);
      return;
    }

    // Advance to the next step (or complete).
    const nextStep = steps.find((s) => s.step_order === stepOrder + 1);
    if (nextStep) {
      const nextAt = new Date(now.getTime() + Math.max(0, nextStep.delay_days || 0) * 86_400_000).toISOString();
      await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .update({ current_step_order: stepOrder + 1, next_send_at: nextAt, last_sent_at: now.toISOString() })
        .eq("id", e.id as string);
    } else {
      await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .update({ status: "completed", next_send_at: null, last_sent_at: now.toISOString(), completed_at: now.toISOString() })
        .eq("id", e.id as string);
    }

    sent++;
  };

  await Promise.allSettled(due.map((e) => processOne(e as Record<string, unknown>)));

  return NextResponse.json({ ok: true, sent, processed: due.length });
}
