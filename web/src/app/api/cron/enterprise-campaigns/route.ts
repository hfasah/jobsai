import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { supabaseAdmin } from "@/lib/supabase";
import { resend } from "@/lib/resend";
import { wrapEmail, emailFromName } from "@/lib/email-utils";
import { recordUsage } from "@/lib/llm-usage";
import { renderTemplate, firstName, type CampaignVars } from "@/lib/campaigns";
import { isWithinSendWindow, nextWindowOpen, type SendWindow } from "@/lib/outreach/send-window";
import { loadSuppressedSet } from "@/lib/outreach/suppression";
import { runSubsequences } from "@/lib/outreach/subsequences";
import { loadRotationPool, claimFromPool, claimSpecificMailbox, type RotationPool } from "@/lib/outreach/rotation";
import { getConnectedSender, sendViaConnectedMailbox, type ConnectedMailbox } from "@/lib/outreach/connected-send";
import { intakeAddress } from "@/lib/enterprise-intake-inbox";

export const maxDuration = 60;

let _ai: OpenAI | null = null;
const ai = () => (_ai ??= getAIClient(AI_TIERS.fast.provider));

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work";
const BATCH = 120;

// Vercel Cron Jobs invoke the endpoint with a GET request — delegate to the
// handler so scheduled runs actually execute (POST kept for manual triggers).
export async function GET(req: NextRequest) {
  return POST(req);
}

// Runs on the schedule in vercel.json. Walks every active enrollment whose next
// step is due, sends it, records a send row (per-step analytics), schedules next.
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Activate any scheduled campaigns whose time has come, so their enrollments
  // start sending on this run.
  await supabaseAdmin
    .from("enterprise_campaigns")
    .update({ status: "active", updated_at: now.toISOString() })
    .eq("status", "scheduled")
    .lte("scheduled_at", now.toISOString());

  // Self-heal the first touch. A never-sent, step-0 enrolment in a LIVE,
  // non-pilot campaign whose FIRST step sends immediately (delay 0) must be due
  // now — but launch/enrol quirks can leave it null OR mis-dated to the future,
  // so it never sends. Pull all such enrolments to "now" so the send query
  // below picks them up on this same run. (Campaigns with a deliberate delayed
  // first touch are left alone; a pilot leaves held rows on purpose.)
  const { data: liveCampaigns } = await supabaseAdmin
    .from("enterprise_campaigns")
    .select("id")
    .eq("status", "active")
    .or("pilot_size.is.null,pilot_released.eq.true");
  const liveIds = ((liveCampaigns ?? []) as { id: string }[]).map((c) => c.id);
  if (liveIds.length > 0) {
    const { data: firstSteps } = await supabaseAdmin
      .from("enterprise_campaign_steps")
      .select("campaign_id, delay_days")
      .in("campaign_id", liveIds)
      .eq("step_order", 0);
    const immediateIds = ((firstSteps ?? []) as { campaign_id: string; delay_days: number | null }[])
      .filter((s) => (s.delay_days ?? 0) <= 0)
      .map((s) => s.campaign_id);
    if (immediateIds.length > 0) {
      const { data: healed } = await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .update({ next_send_at: now.toISOString() })
        .eq("status", "active")
        .eq("current_step_order", 0)
        .is("last_sent_at", null)
        .in("campaign_id", immediateIds)
        .select("id");
      if (healed && healed.length > 0) console.log(`[campaigns cron] scheduled ${healed.length} first-touch enrolment(s) to send now`);
    }
  }

  const { data: due } = await supabaseAdmin
    .from("enterprise_campaign_enrollments")
    .select("*, campaign:enterprise_campaigns(status, track_opens, mailbox_strategy, mailbox_id, daily_send_limit, holidays, send_jitter_hours, send_window_start, send_window_end, send_timezone, business_days_only), job:enterprise_jobs(title), org:enterprise_orgs(name, show_powered_by, white_label_email_from, reply_to_email, slug, intake_email_handle)")
    .eq("status", "active")
    .not("next_send_at", "is", null)
    .lte("next_send_at", now.toISOString())
    .order("next_send_at", { ascending: true })
    .limit(BATCH);

  console.log(`[campaigns cron] due enrolments: ${due?.length ?? 0}`);
  if (!due || due.length === 0) {
    // Diagnostic: why is nothing due? Dump the schedule of active enrolments.
    const { data: sample } = await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .select("next_send_at, current_step_order, last_sent_at, email_status, campaign:enterprise_campaigns(name, status, pilot_size, pilot_released)")
      .eq("status", "active")
      .limit(20);
    console.log("[campaigns cron] 0 due; active enrolments:", JSON.stringify((sample ?? []).map((s) => {
      const c = s.campaign as { name?: string; status?: string; pilot_size?: number | null; pilot_released?: boolean } | null;
      return { nsa: s.next_send_at, step: s.current_step_order, sent: s.last_sent_at, email_status: s.email_status, camp: c?.name, status: c?.status, pilot: c?.pilot_size, released: c?.pilot_released };
    })), "now:", now.toISOString());
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // One rotation pool per org in this batch (mailbox rotation across the
  // org's healthy sending mailboxes; legacy shared-address send when none).
  const orgIds = [...new Set(due.map((e) => e.org_id as string))];
  const pools = new Map<string, RotationPool>();
  await Promise.all(orgIds.map(async (orgId) => pools.set(orgId, await loadRotationPool(orgId))));

  // Connected-mailbox senders (Gmail/Outlook) per org — the "easy" path: send
  // from the recruiter's own inbox so replies thread back there. Used when the
  // org has no domain mailboxes (or an enrolment is already locked to it).
  const connectedSenders = new Map<string, ConnectedMailbox | null>();
  await Promise.all(orgIds.map(async (orgId) => connectedSenders.set(orgId, await getConnectedSender(orgId))));

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

  // For steps flagged skip_if_in_pipeline: which of this batch's candidates are
  // already in an org's pipeline? One batched lookup keyed by org|lower(email).
  const inPipeline = new Set<string>();
  const pipelineCandidates = due.filter((e) => {
    const s = (stepsByCampaign.get(e.campaign_id) ?? []).find((x) => x!.step_order === (e.current_step_order as number));
    return s?.skip_if_in_pipeline;
  });
  if (pipelineCandidates.length > 0) {
    const emails = [...new Set(pipelineCandidates.map((e) => (e.candidate_email as string).toLowerCase()))];
    for (let i = 0; i < emails.length; i += 100) {
      const chunk = emails.slice(i, i + 100);
      const { data: apps } = await supabaseAdmin
        .from("enterprise_applications").select("org_id, candidate_email")
        .in("org_id", orgIds).in("candidate_email", chunk);
      for (const a of apps ?? []) inPipeline.add(`${a.org_id}|${(a.candidate_email as string).toLowerCase()}`);
    }
  }

  // Do-Not-Contact: org-wide suppressed addresses in this batch. Final gate
  // before any send — authoritative even if a suppressed contact slipped past
  // the enrollment-time check (e.g. imported, or suppressed after enrolling).
  const suppressedByOrg = new Map<string, Set<string>>();
  await Promise.all(orgIds.map(async (orgId) => {
    const emails = due.filter((e) => e.org_id === orgId).map((e) => e.candidate_email as string);
    suppressedByOrg.set(orgId, await loadSuppressedSet(orgId, emails));
  }));

  // Per-campaign sends already made today (for the daily-limit cap).
  const todayStart = now.toISOString().slice(0, 10) + "T00:00:00Z";
  const sentToday = new Map<string, number>();
  await Promise.all(campaignIds.map(async (cid) => {
    const { count } = await supabaseAdmin
      .from("enterprise_campaign_sends").select("id", { count: "exact", head: true })
      .eq("campaign_id", cid).gte("sent_at", todayStart);
    sentToday.set(cid as string, count ?? 0);
  }));

  let sent = 0;

  const processOne = async (e: Record<string, unknown>) => {
    const campaign = e.campaign as
      | ({ status: string; daily_send_limit?: number | null; holidays?: string[] | null; send_jitter_hours?: number | null } & SendWindow)
      | null;
    // Only send for live campaigns. Paused/draft enrollments wait (next_send_at
    // stays put, so they resume the moment the campaign goes active again).
    if (campaign?.status !== "active") return;

    // Do-Not-Contact: hard stop. Never email a suppressed address; retire the
    // enrollment so it's not reconsidered.
    if ((suppressedByOrg.get(e.org_id as string) ?? new Set()).has((e.candidate_email as string).toLowerCase())) {
      await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .update({ status: "unsubscribed", next_send_at: null })
        .eq("id", e.id as string);
      return;
    }

    // Holiday: skip today entirely — defer to the next send window.
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: campaign.send_timezone || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    if ((campaign.holidays ?? []).includes(localDate)) {
      await supabaseAdmin.from("enterprise_campaign_enrollments")
        .update({ next_send_at: nextWindowOpen(campaign, new Date(now.getTime() + 86_400_000)).toISOString() })
        .eq("id", e.id as string);
      return;
    }

    // Daily send limit for the campaign.
    const cid = e.campaign_id as string;
    if (campaign.daily_send_limit && (sentToday.get(cid) ?? 0) >= campaign.daily_send_limit) {
      await supabaseAdmin.from("enterprise_campaign_enrollments")
        .update({ next_send_at: nextWindowOpen(campaign, new Date(now.getTime() + 86_400_000)).toISOString() })
        .eq("id", e.id as string);
      return;
    }

    // Send window: outside the campaign's local-time window (or on a weekend
    // when business-days-only), park the enrollment until the window opens.
    if (!isWithinSendWindow(campaign, now)) {
      console.log(`[campaigns cron] defer(window) ${e.candidate_email} tz=${campaign.send_timezone} start=${campaign.send_window_start} end=${campaign.send_window_end} biz=${campaign.business_days_only}`);
      await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .update({ next_send_at: nextWindowOpen(campaign, now).toISOString() })
        .eq("id", e.id as string);
      return;
    }

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

    // Per-step condition: skip (advance without sending) if the candidate is
    // already in the pipeline. Don't email someone who's already progressed.
    if (step.skip_if_in_pipeline && inPipeline.has(`${e.org_id}|${(e.candidate_email as string).toLowerCase()}`)) {
      const next = steps.find((s) => s.step_order === stepOrder + 1);
      await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .update(next
          ? { current_step_order: stepOrder + 1, next_send_at: new Date(now.getTime() + Math.max(0, next.delay_days || 0) * 86_400_000).toISOString() }
          : { status: "completed", next_send_at: null, completed_at: now.toISOString() })
        .eq("id", e.id as string);
      return;
    }

    // Deliverability backstop: never send to an address the verifier flagged
    // INVALID — it will bounce and hurt sender reputation. Retire the enrolment
    // (skip, don't error the run). Catches invalids enrolled before the import
    // guard existed. valid/risky/unknown still send.
    if ((e.email_status as string | null) === "invalid") {
      await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .update({ status: "bounced", next_send_at: null })
        .eq("id", e.id as string);
      return;
    }

    const org = e.org as { name: string; show_powered_by: boolean; white_label_email_from: string | null; reply_to_email: string | null; slug: string | null; intake_email_handle: string | null } | null;
    const orgName = org?.name ?? "Recruiting";
    // Reply-to = the org's intake address, so candidate replies land straight in
    // the AI SDR Inbox (Resend inbound webhook -> processReply), auto-classified
    // and shared team-wide — no forwarding setup, no dependence on the sender's
    // mailbox. Falls back to reply_to_email, then none.
    const replyTo = (org?.slug ? intakeAddress({ slug: org.slug, intake_email_handle: org.intake_email_handle }) : null)
      || org?.reply_to_email?.trim() || null;
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

    // A/B: sticky per-enrollment bucket (assigned on first send, persisted so
    // a candidate sees a consistent variant across the whole sequence).
    let bucket = (e.ab_bucket as "A" | "B" | null) ?? null;
    if (!bucket) {
      let hash = 0;
      const email = (e.candidate_email as string) ?? "";
      for (let i = 0; i < email.length; i++) hash = (hash * 31 + email.charCodeAt(i)) | 0;
      bucket = Math.abs(hash) % 2 === 0 ? "A" : "B";
      await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .update({ ab_bucket: bucket })
        .eq("id", e.id as string);
    }
    const useB = bucket === "B" && !!(step.ab_subject || step.ab_body);
    const variant = useB ? "B" : step.ab_subject || step.ab_body ? "A" : null;

    let subject = renderTemplate(useB && step.ab_subject ? step.ab_subject : step.subject, vars);
    let bodyText = renderTemplate(useB && step.ab_body ? step.ab_body : step.body, vars);

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

    // Mailbox rotation: claim a slot on the org's healthiest mailbox. Falls
    // back to the legacy shared address when the org has no domain mailboxes;
    // when it HAS mailboxes but they're all exhausted/paused, defer to
    // tomorrow rather than overflowing onto the shared domain.
    //
    // Sender lock: once a candidate has been emailed from a mailbox, every later
    // step in the sequence must come from that SAME sender (no rotating senders
    // mid-conversation). We lock it on first send and only claim that mailbox
    // thereafter; if the locked mailbox is unavailable (paused/exhausted) we
    // defer rather than switch identity.
    const pool = pools.get(e.org_id as string) ?? { mailboxes: [] };
    let fromEmail = "support@jobsai.work";
    let mailboxId: string | null = null;
    let lockMailboxId: string | null = null; // set when we newly lock this enrollment
    let connectedSender: ConnectedMailbox | null = null;

    const lockedId = (e.mailbox_id as string | null) ?? null;
    const orgConnected = connectedSenders.get(e.org_id as string) ?? null;
    // Send via the recruiter's connected inbox when the org has no domain
    // mailboxes, or when this enrolment is already locked to that connected
    // mailbox (keep the sender consistent across the whole sequence).
    const useConnected = !!orgConnected && (pool.mailboxes.length === 0 || lockedId === orgConnected.id);

    if (useConnected && orgConnected) {
      connectedSender = orgConnected;
      fromEmail = orgConnected.address;
      mailboxId = orgConnected.id;
      if (!lockedId) lockMailboxId = orgConnected.id;
    } else if (pool.mailboxes.length > 0) {
      const camp = campaign as { mailbox_strategy?: string; mailbox_id?: string | null };
      const claimed = lockedId
        ? await claimSpecificMailbox(pool, lockedId)
        : await claimFromPool(pool, camp.mailbox_strategy === "fixed" ? camp.mailbox_id ?? null : null);
      if (!claimed) {
        await supabaseAdmin
          .from("enterprise_campaign_enrollments")
          .update({ next_send_at: new Date(now.getTime() + 86_400_000).toISOString() })
          .eq("id", e.id as string);
        return;
      }
      fromEmail = claimed.address;
      mailboxId = claimed.id;
      if (!lockedId) lockMailboxId = claimed.id; // first send → remember to persist the lock
    }

    // Insert the send row first so we have an id for the open-tracking pixel.
    // Idempotency: one send row per (campaign, enrollment, step). If another
    // cron run already claimed this step, the insert conflicts and returns no
    // row — skip so we never double-send on a retry or overlapping run.
    const { data: send } = await supabaseAdmin
      .from("enterprise_campaign_sends")
      .upsert(
        {
          enrollment_id: e.id as string,
          campaign_id: e.campaign_id as string,
          step_id: step.id,
          step_order: stepOrder,
          org_id: e.org_id as string,
          candidate_email: e.candidate_email as string,
          subject,
          variant,
          mailbox_id: mailboxId,
          from_email: fromEmail,
        },
        { onConflict: "campaign_id,enrollment_id,step_order", ignoreDuplicates: true },
      )
      .select("id")
      .maybeSingle();
    if (!send) { console.log(`[campaigns cron] skip(send-row-exists) ${e.candidate_email} step=${stepOrder}`); return; } // already sent by another run

    // Open-tracking pixel — omitted when the campaign turns it off (better deliverability).
    const trackOpens = (campaign as { track_opens?: boolean }).track_opens !== false;
    const pixel = trackOpens ? `<img src="${BASE_URL}/api/enterprise/campaigns/track?s=${send.id}" width="1" height="1" alt="" style="display:none"/>` : "";

    // One-click unsubscribe: an opaque per-enrollment token (never exposes ids).
    // Powers both the footer link and the List-Unsubscribe header.
    const unsubToken = e.unsubscribe_token as string | null;
    const unsubUrl = unsubToken ? `${BASE_URL}/api/outreach/unsubscribe?t=${unsubToken}` : null;
    const unsubFooter = unsubUrl
      ? `<p style="color:#94a3b8;font-size:12px;margin:18px 0 0">Not the right time? <a href="${unsubUrl}" style="color:#94a3b8">Unsubscribe</a> and we won't email you again.</p>`
      : "";
    const html = wrapEmail(`<p>${bodyText.replace(/\n/g, "<br>")}</p>${pixel}${unsubFooter}`, showPoweredBy);

    try {
      if (connectedSender) {
        // Send from the recruiter's own Gmail/Outlook. Replies thread back to
        // their inbox; no reply-to routing needed.
        const r = await sendViaConnectedMailbox(connectedSender, {
          to: e.candidate_email as string,
          subject,
          html,
          fromName,
          replyTo,
        });
        if (!r.ok) throw new Error(r.error ?? "connected send failed");
      } else {
        await resend.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to: e.candidate_email as string,
          subject,
          html,
          ...(replyTo ? { replyTo } : {}),
          ...(unsubUrl ? { headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
        });
      }
    } catch (err) {
      // Leave the send row; mark enrollment bounced so it doesn't retry forever.
      console.log(`[campaigns cron] SEND FAILED ${e.candidate_email} via ${connectedSender ? connectedSender.address : fromEmail}: ${String(err).slice(0, 120)}`);
      await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .update({ status: "bounced", next_send_at: null })
        .eq("id", e.id as string);
      return;
    }
    console.log(`[campaigns cron] SENT ${e.candidate_email} via ${connectedSender ? connectedSender.address : fromEmail}`);

    // Count this send toward the campaign's daily cap.
    sentToday.set(cid, (sentToday.get(cid) ?? 0) + 1);

    // Advance to the next step (or complete). A jitter of 0..N hours makes the
    // next send look less machine-timed.
    const lockPatch = lockMailboxId ? { mailbox_id: lockMailboxId } : {};
    const nextStep = steps.find((s) => s.step_order === stepOrder + 1);
    if (nextStep) {
      const jitterMs = Math.floor(Math.random() * Math.max(0, campaign.send_jitter_hours ?? 0) * 3_600_000);
      const nextAt = new Date(now.getTime() + Math.max(0, nextStep.delay_days || 0) * 86_400_000 + jitterMs).toISOString();
      await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .update({ current_step_order: stepOrder + 1, next_send_at: nextAt, last_sent_at: now.toISOString(), ...lockPatch })
        .eq("id", e.id as string);
    } else {
      await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .update({ status: "completed", next_send_at: null, last_sent_at: now.toISOString(), completed_at: now.toISOString(), ...lockPatch })
        .eq("id", e.id as string);
      // Sequence finished with no reply → fire any 'sequence_completed' rules.
      await runSubsequences({
        orgId: e.org_id as string, campaignId: e.campaign_id as string, trigger: "sequence_completed",
        candidateEmail: e.candidate_email as string, candidateName: (e.candidate_name as string) ?? null,
      }).catch(() => {});
    }

    sent++;
  };

  await Promise.allSettled(due.map((e) => processOne(e as Record<string, unknown>)));

  // Auto-complete: an active campaign whose enrollments have all finished
  // sending (none left active/pending) is done — flip it to 'completed' so its
  // lifecycle is accurate and it drops out of the "active" view.
  await Promise.allSettled(
    campaignIds.map(async (cid) => {
      const { count } = await supabaseAdmin
        .from("enterprise_campaign_enrollments")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", cid)
        .in("status", ["active", "pending"]);
      if ((count ?? 0) === 0) {
        await supabaseAdmin
          .from("enterprise_campaigns")
          .update({ status: "completed", updated_at: now.toISOString() })
          .eq("id", cid)
          .eq("status", "active");
      }
    }),
  );

  return NextResponse.json({ ok: true, sent, processed: due.length });
}
