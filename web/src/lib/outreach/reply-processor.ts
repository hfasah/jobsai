// AI SDR reply processor: classify an inbound reply, roll it up into the
// candidate's inbox thread, and fire deterministic auto-actions. Called from
// the inbound email webhook (and reusable elsewhere). SERVER-ONLY.
import { clerkClient } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resend } from "@/lib/resend";
import { emailFromName } from "@/lib/email-utils";
import { classifyIntent, isPositiveIntent, type Intent, type InterestLevel } from "./intent";
import { maybeEnqueueAiSdrReply } from "./ai-sdr";

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work").replace(/\/$/, "");

export interface ReplyInput {
  orgId: string;
  candidateEmail: string;
  candidateName?: string | null;
  applicationId?: string | null;
  subject: string;
  body: string;
}

export interface ReplyOutcome {
  threadId: string;
  intent: Intent;
  confidence: number;
  interestLevel: InterestLevel;
  autoActions: string[];
}

// Stop every active sequence for this candidate the moment they reply — the
// gap the explorer flagged (the webhook only handled sourcing outreach).
async function pauseSequences(orgId: string, email: string, intent: Intent): Promise<string[]> {
  const actions: string[] = [];
  const now = new Date().toISOString();

  // Out-of-office is an automated bounce-back, not a real reply — don't stop the
  // sequence. Defer the next send a few days so it resumes after they're back.
  if (intent === "out_of_office") {
    const resumeAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const { data: def } = await supabaseAdmin
      .from("enterprise_campaign_enrollments")
      .update({ next_send_at: resumeAt })
      .eq("org_id", orgId)
      .ilike("candidate_email", email)
      .eq("status", "active")
      .select("id");
    if ((def ?? []).length) actions.push("deferred_out_of_office");
    return actions;
  }

  // Sourcing outreach follow-ups.
  const { data: so } = await supabaseAdmin
    .from("enterprise_sourcing_outreach")
    .update(intent === "unsubscribe" ? { replied_at: now, unsubscribed: true } : { replied_at: now })
    .eq("org_id", orgId)
    .ilike("candidate_email", email)
    .is("replied_at", null)
    .select("id");
  if ((so ?? []).length) actions.push(intent === "unsubscribe" ? "unsubscribed_sourcing" : "stopped_sourcing_followups");

  // Campaign enrollments — auto-pause-on-reply (previously manual only).
  const targetStatus = intent === "unsubscribe" ? "unsubscribed" : "replied";
  const { data: enr } = await supabaseAdmin
    .from("enterprise_campaign_enrollments")
    .update({ status: targetStatus, replied_at: now, next_send_at: null })
    .eq("org_id", orgId)
    .ilike("candidate_email", email)
    .eq("status", "active")
    .select("id");
  if ((enr ?? []).length) actions.push(intent === "unsubscribe" ? "unsubscribed_campaigns" : "paused_campaigns");

  return actions;
}

async function notifyPositiveIntent(args: {
  orgId: string;
  candidateName: string;
  candidateEmail: string;
  intent: Intent;
  summary: string;
  threadId: string;
}): Promise<void> {
  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("name, white_label_email_from")
    .eq("id", args.orgId)
    .maybeSingle();
  const orgRow = org as { name?: string; white_label_email_from?: string | null } | null;
  const orgName = orgRow?.name ?? "Recruiting";

  // Notify org owners/admins/recruiters (the people who can act on a warm
  // reply). enterprise_members holds only Clerk user_ids — resolve emails
  // through Clerk, like the digest cron.
  const { data: members } = await supabaseAdmin
    .from("enterprise_members")
    .select("user_id")
    .eq("org_id", args.orgId)
    .in("role", ["owner", "admin", "recruiter"])
    .limit(25);
  const userIds = ((members ?? []) as { user_id: string }[]).map((m) => m.user_id);
  if (userIds.length === 0) return;
  const clerk = await clerkClient();
  const emails = await Promise.all(
    userIds.map(async (uid) => {
      try {
        const user = await clerk.users.getUser(uid);
        return user.emailAddresses[0]?.emailAddress ?? null;
      } catch {
        return null;
      }
    }),
  );
  const to = [...new Set(emails.filter((e): e is string => !!e))];
  if (to.length === 0) return;

  const label = args.intent === "meeting_requested" ? "wants to book a meeting" : "is interested";
  const fromName = emailFromName(orgName, orgRow?.white_label_email_from ?? null);
  await resend.emails
    .send({
      from: `${fromName} <support@jobsai.work>`,
      to,
      subject: `🔥 ${args.candidateName} ${label}`,
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <h3 style="color:#2563eb">Positive reply</h3>
        <p><strong>${args.candidateName}</strong> (${args.candidateEmail}) ${label}.</p>
        <p style="color:#475569">${args.summary}</p>
        <p><a href="${APP_URL}/enterprise/outreach/inbox?thread=${args.threadId}">Open in the inbox →</a></p>
      </div>`,
    })
    .catch((e) => console.error("[reply-processor] notify failed", e));
}

export async function processReply(input: ReplyInput): Promise<ReplyOutcome> {
  const email = input.candidateEmail.toLowerCase();
  const now = new Date().toISOString();

  const cls = await classifyIntent({ subject: input.subject, body: input.body, orgId: input.orgId });

  // Upsert the thread rollup. A manual intent override on an existing thread is
  // preserved (don't let a later auto-classification stomp a human decision on
  // the SAME reply set — but a genuinely new inbound reply re-opens it).
  const { data: existing } = await supabaseAdmin
    .from("inbox_threads")
    .select("id, reply_count, intent_manual")
    .eq("org_id", input.orgId)
    .eq("candidate_email", email)
    .maybeSingle();
  const prior = existing as { id: string; reply_count: number; intent_manual: boolean } | null;

  let threadId: string;
  if (prior) {
    const patch: Record<string, unknown> = {
      candidate_name: input.candidateName ?? undefined,
      application_id: input.applicationId ?? undefined,
      last_inbound_at: now,
      reply_count: prior.reply_count + 1,
      unread: true,
      status: "open",
      updated_at: now,
    };
    // A fresh inbound reply supersedes a prior manual label.
    patch.intent = cls.intent;
    patch.intent_confidence = cls.confidence;
    patch.intent_manual = false;
    patch.ai_summary = cls.summary;
    patch.interest_score = cls.interestScore;
    patch.interest_level = cls.interestLevel;
    await supabaseAdmin.from("inbox_threads").update(patch).eq("id", prior.id).eq("org_id", input.orgId);
    threadId = prior.id;
  } else {
    const { data: created } = await supabaseAdmin
      .from("inbox_threads")
      .insert({
        org_id: input.orgId,
        candidate_email: email,
        candidate_name: input.candidateName ?? null,
        application_id: input.applicationId ?? null,
        intent: cls.intent,
        intent_confidence: cls.confidence,
        ai_summary: cls.summary,
        interest_score: cls.interestScore,
        interest_level: cls.interestLevel,
        last_inbound_at: now,
        reply_count: 1,
        unread: true,
      })
      .select("id")
      .single();
    threadId = (created as { id: string }).id;
  }

  // Auto-actions.
  const autoActions = await pauseSequences(input.orgId, email, cls.intent);
  if (isPositiveIntent(cls.intent)) {
    await notifyPositiveIntent({
      orgId: input.orgId,
      candidateName: input.candidateName ?? email,
      candidateEmail: email,
      intent: cls.intent,
      summary: cls.summary,
      threadId,
    });
    autoActions.push("notified_team");
  }

  // AI SDR: draft (and maybe queue) a grounded auto-reply for the candidate's
  // campaign. Best-effort — never blocks the reply pipeline.
  await maybeEnqueueAiSdrReply({
    orgId: input.orgId,
    threadId,
    candidateEmail: email,
    candidateName: input.candidateName ?? null,
    applicationId: input.applicationId ?? null,
    intent: cls.intent,
    confidence: cls.confidence,
    interestLevel: cls.interestLevel,
  });

  return { threadId, intent: cls.intent, confidence: cls.confidence, interestLevel: cls.interestLevel, autoActions };
}
