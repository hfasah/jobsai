// Per-campaign AI SDR: pick the campaign a reply belongs to, assemble its
// knowledge base + memory into a grounded prompt, decide whether an auto-reply
// is allowed (guardrails), draft it, and schedule when it may send. Pure-ish
// server lib — the inbound hook (processReply) and the send cron wire it up.
// SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { recordUsage } from "@/lib/llm-usage";
import { getRecruiterIdentity } from "@/lib/sourcing-email";
import { getOrCreateBookingLink, openSlotsForLink, urlForBookingLink, bookSlot } from "@/lib/booking";
import { isWithinSendWindow, nextWindowOpen, type SendWindow } from "./send-window";
import type { Intent, InterestLevel } from "./intent";

// Campaign row + AI SDR config (subset of enterprise_campaigns columns).
export interface AiSdrCampaign {
  id: string;
  name: string;
  status: string;
  created_by: string;
  ai_sdr_enabled: boolean;
  ai_sdr_mode: "manual" | "draft" | "auto";
  ai_sdr_persona: string | null;
  ai_sdr_guardrails: string | null;
  ai_sdr_min_confidence: number;
  ai_sdr_max_replies: number;
  ai_sdr_tier: "smart" | "fast";
  send_window_start: number | null;
  send_window_end: number | null;
  send_timezone: string | null;
  business_days_only: boolean;
}

const CAMPAIGN_COLS =
  "id, name, status, created_by, ai_sdr_enabled, ai_sdr_mode, ai_sdr_persona, ai_sdr_guardrails, " +
  "ai_sdr_min_confidence, ai_sdr_max_replies, ai_sdr_tier, " +
  "send_window_start, send_window_end, send_timezone, business_days_only";

// KB + memory packed into the prompt is capped so a huge campaign KB can't blow
// up cost/latency. Pinned docs win the budget first. (Embedding retrieval is a
// later upgrade if a campaign outgrows this.)
const KB_CHAR_BUDGET = 6000;

export interface CampaignMatch {
  campaign: AiSdrCampaign;
  enrollmentId: string | null;
  candidateName: string | null;
}

// Which campaign does this inbound reply belong to? A candidate can sit in more
// than one campaign, so prefer the enrollment that most recently emailed them.
// Returns null when the email isn't tied to any AI-SDR-enabled campaign.
export async function getCampaignForReply(orgId: string, email: string): Promise<CampaignMatch | null> {
  const { data } = await supabaseAdmin
    .from("enterprise_campaign_enrollments")
    .select(`id, candidate_name, last_sent_at, campaign:enterprise_campaigns(${CAMPAIGN_COLS})`)
    .eq("org_id", orgId)
    .ilike("candidate_email", email)
    .order("last_sent_at", { ascending: false, nullsFirst: false })
    .limit(10);

  const rows = (data ?? []) as unknown as {
    id: string;
    candidate_name: string | null;
    campaign: AiSdrCampaign | null;
  }[];

  for (const row of rows) {
    const c = row.campaign;
    if (c && c.ai_sdr_enabled && c.status === "active") {
      return { campaign: c, enrollmentId: row.id, candidateName: row.candidate_name };
    }
  }
  return null;
}

// Concatenate the campaign's knowledge base + operator memory into a single
// grounding block, pinned/most-recent first, capped at the char budget.
export async function buildKnowledgeContext(orgId: string, campaignId: string): Promise<string> {
  const [{ data: kb }, { data: mem }] = await Promise.all([
    supabaseAdmin
      .from("ai_sdr_knowledge")
      .select("title, content, pinned")
      .eq("org_id", orgId)
      .eq("campaign_id", campaignId)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("ai_sdr_memory")
      .select("kind, content")
      .eq("org_id", orgId)
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const parts: string[] = [];
  let used = 0;
  const push = (s: string) => {
    if (used >= KB_CHAR_BUDGET) return;
    const clipped = s.slice(0, KB_CHAR_BUDGET - used);
    parts.push(clipped);
    used += clipped.length;
  };

  const notes = (mem ?? []) as { kind: string; content: string }[];
  if (notes.length) {
    push("## Operator notes (always follow)\n" + notes.map((m) => `- [${m.kind}] ${m.content}`).join("\n") + "\n");
  }
  const docs = (kb ?? []) as { title: string; content: string; pinned: boolean }[];
  for (const d of docs) push(`## ${d.title}${d.pinned ? " (pinned)" : ""}\n${d.content}\n`);

  return parts.join("\n").trim();
}

// ── Guardrails ──────────────────────────────────────────────────────────────
// Intents that a bot may reply to at all. Everything else (declines, opt-outs,
// auto-replies) is handled by humans / suppression — never auto-answered.
const REPLYABLE_INTENTS: Intent[] = ["interested", "meeting_requested", "referral", "question", "neutral"];

export interface AutoReplyGate {
  ok: boolean;                       // may we generate + queue a reply at all?
  autoSend: boolean;                 // may the cron send without human review?
  reason: string;                    // why suppressed / how it was decided
}

export function evaluateAutoReply(args: {
  campaign: AiSdrCampaign;
  intent: Intent;
  confidence: number;
  interestLevel: InterestLevel;
  priorAiReplies: number;            // AI replies already sent on this thread
  minutesSinceLastOutbound: number | null; // throttle / loop guard
}): AutoReplyGate {
  const { campaign, intent, confidence, priorAiReplies, minutesSinceLastOutbound } = args;

  if (!campaign.ai_sdr_enabled) return { ok: false, autoSend: false, reason: "AI SDR disabled." };
  if (campaign.ai_sdr_mode === "manual") return { ok: false, autoSend: false, reason: "Manual mode — a recruiter writes every reply." };
  if (!REPLYABLE_INTENTS.includes(intent)) return { ok: false, autoSend: false, reason: `Intent "${intent}" is handled by a human.` };
  if (priorAiReplies >= campaign.ai_sdr_max_replies) {
    return { ok: false, autoSend: false, reason: `Reached ${campaign.ai_sdr_max_replies} AI replies on this thread — handing off.` };
  }
  // Loop guard: don't fire again right after our own last outbound (catches
  // bot↔auto-responder ping-pong).
  if (minutesSinceLastOutbound !== null && minutesSinceLastOutbound < 10) {
    return { ok: false, autoSend: false, reason: "Just sent an outbound — throttled to avoid loops." };
  }

  // A draft is always allowed for a replyable intent; auto-send needs the
  // campaign in auto mode AND confidence above the floor.
  const autoSend = campaign.ai_sdr_mode === "auto" && confidence >= campaign.ai_sdr_min_confidence;
  return {
    ok: true,
    autoSend,
    reason: autoSend
      ? "Auto-send: confidence above floor."
      : campaign.ai_sdr_mode === "auto"
        ? `Held for review: confidence ${confidence.toFixed(2)} below floor ${campaign.ai_sdr_min_confidence}.`
        : "Draft-only mode: awaiting human review.",
  };
}

// ── Drafting ────────────────────────────────────────────────────────────────
export interface TranscriptMessage {
  direction: "inbound" | "outbound";
  body: string;
}

export interface DraftResult {
  subject: string;
  body: string;
  needsHuman: boolean;               // model flagged it can't answer from the KB
  bookSlot: string | null;           // agreed open time (validated ISO) to book at send
  model: string;
  inputTokens: number;
  outputTokens: number;
}

function buildSystemPrompt(args: {
  persona: string | null;
  guardrails: string | null;
  knowledge: string;
  orgName: string;
  recruiterName: string;
  bookingUrl?: string | null;
  openSlots?: { iso: string; label: string }[];
}): string {
  const slots = args.openSlots ?? [];
  let scheduling: string;
  if (slots.length > 0) {
    scheduling = [
      `SCHEDULING: you can book meetings directly on ${args.recruiterName}'s calendar. These times are currently OPEN:`,
      ...slots.map((s, i) => `${i + 1}. ${s.label}  [iso: ${s.iso}]`),
      `- When the conversation turns to scheduling, naturally offer 2-3 of these times in plain language (never show the iso values).`,
      `- If the candidate clearly agrees to ONE specific open time from this list, set "book_slot" to that time's exact iso value and write the body as a warm confirmation — the calendar invite with the meeting link is sent automatically ("I've booked us in for Wednesday at 9:30 — invite on its way.").`,
      `- If they suggest a time that is NOT on the list, do NOT book it: offer the nearest open times instead${args.bookingUrl ? `, and include this self-serve link as an alternative: ${args.bookingUrl}` : ""}.`,
      `- Never invent times or links. Book only times from the list, and only after clear agreement.`,
    ].join("\n");
  } else if (args.bookingUrl) {
    scheduling = `SCHEDULING: when the candidate shows interest, asks about next steps, or wants to talk, invite them to pick a time on ${args.recruiterName}'s calendar using exactly this link: ${args.bookingUrl} — never propose specific times yourself and never invent any other scheduling link.`;
  } else {
    scheduling = `SCHEDULING: you cannot book meetings — if the candidate wants to schedule, say ${args.recruiterName} will follow up with times, and set "needs_human": true.`;
  }
  return [
    `You are an AI Sales Development Rep replying on behalf of ${args.recruiterName} at ${args.orgName} to a candidate who answered a recruiting outreach email.`,
    args.persona ? `Persona / tone:\n${args.persona}` : `Be warm, concise, and professional. Keep it to a few sentences.`,
    `Ground every factual claim ONLY in the knowledge base below. NEVER invent compensation, dates, titles, or commitments. If the candidate asks something the knowledge base doesn't cover, do NOT guess — set "needs_human": true and write a short holding reply that offers to connect them with ${args.recruiterName}.`,
    scheduling,
    args.guardrails ? `Hard rules (must obey):\n${args.guardrails}` : "",
    args.knowledge ? `--- KNOWLEDGE BASE ---\n${args.knowledge}\n--- END KNOWLEDGE BASE ---` : `(No knowledge base configured — answer only generic scheduling/logistics questions and otherwise set needs_human.)`,
    `Return ONLY JSON: {"subject": "...", "body": "...", "needs_human": true|false, "book_slot": "<iso of the agreed open time, or null>"}. The body is the email text only — no signature block, no "[Your name]" placeholders.`,
  ].filter(Boolean).join("\n\n");
}

export async function draftAutoReply(args: {
  orgId: string;
  campaign: AiSdrCampaign;
  knowledge: string;
  transcript: TranscriptMessage[];
  candidateName: string | null;
  orgName: string;
  recruiterName: string;
  bookingUrl?: string | null;
  openSlots?: { iso: string; label: string }[];
}): Promise<DraftResult> {
  const tier = args.campaign.ai_sdr_tier === "smart" ? AI_TIERS.smart : AI_TIERS.fast;
  const system = buildSystemPrompt({
    persona: args.campaign.ai_sdr_persona,
    guardrails: args.campaign.ai_sdr_guardrails,
    knowledge: args.knowledge,
    orgName: args.orgName,
    recruiterName: args.recruiterName,
    bookingUrl: args.bookingUrl,
    openSlots: args.openSlots,
  });

  // Recent conversation, oldest→newest, capped.
  const convo = args.transcript
    .slice(-8)
    .map((m) => `${m.direction === "inbound" ? args.candidateName || "Candidate" : args.recruiterName}: ${m.body.slice(0, 1200)}`)
    .join("\n\n");

  const completion = await getAIClient(tier.provider).chat.completions.create({
    model: tier.model,
    response_format: { type: "json_object" },
    temperature: 0.4,
    max_tokens: 600,
    messages: [
      { role: "system", content: system },
      { role: "user", content: `Conversation so far:\n\n${convo}\n\nWrite the next reply from ${args.recruiterName}.` },
    ],
  });
  recordUsage({ orgId: args.orgId, feature: "ai_sdr_reply", model: tier.model, usage: completion.usage });

  const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
  const subject = typeof parsed.subject === "string" ? parsed.subject.slice(0, 200) : "";
  const body = typeof parsed.body === "string" ? parsed.body.trim() : "";
  const needsHuman = parsed.needs_human === true || !body;
  // Only accept a book_slot that is EXACTLY one of the open times we offered —
  // the model can never book an invented or stale time.
  const offered = new Set((args.openSlots ?? []).map((s) => s.iso));
  const bookSlot = typeof parsed.book_slot === "string" && offered.has(parsed.book_slot) ? parsed.book_slot : null;

  return {
    subject,
    body,
    needsHuman,
    bookSlot,
    model: tier.model,
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  };
}

// ── Scheduling ──────────────────────────────────────────────────────────────
// A human-like delay before an auto-reply goes out (feels less robotic, gives a
// window to catch a bad draft), pushed into the campaign's send window. `jitter`
// is injected (0..1) so the caller controls randomness — the cron passes
// Math.random(); tests can pass a fixed value.
export function scheduleAutoReply(campaign: AiSdrCampaign, now: Date, jitter: number): Date {
  const minMs = 3 * 60_000;   // 3 min floor
  const spanMs = 7 * 60_000;  // up to +7 min
  let when = new Date(now.getTime() + minMs + Math.floor(Math.max(0, Math.min(1, jitter)) * spanMs));

  const window: SendWindow = {
    send_window_start: campaign.send_window_start,
    send_window_end: campaign.send_window_end,
    send_timezone: campaign.send_timezone,
    business_days_only: campaign.business_days_only,
  };
  if (!isWithinSendWindow(window, when)) when = nextWindowOpen(window, when);
  return when;
}

// ── Orchestration: called from processReply after an inbound reply lands ─────
// Best-effort — resolves the campaign, runs guardrails, drafts a grounded
// reply, and inserts an ai_sdr_replies row (status 'queued' for auto-send,
// 'needs_review' for a human). Never throws (the caller is fire-and-forget).
export async function maybeEnqueueAiSdrReply(args: {
  orgId: string;
  threadId: string;
  candidateEmail: string;
  candidateName: string | null;
  applicationId: string | null;
  intent: Intent;
  confidence: number;
  interestLevel: InterestLevel;
}): Promise<void> {
  try {
    const email = args.candidateEmail.toLowerCase();

    // Workspace kill switch — no drafting at all when the org paused AI SDR.
    const { data: orgRow } = await supabaseAdmin
      .from("enterprise_orgs")
      .select("name, ai_sdr_paused")
      .eq("id", args.orgId)
      .maybeSingle();
    const org = orgRow as { name?: string; ai_sdr_paused?: boolean } | null;
    if (org?.ai_sdr_paused) return;
    const orgName = org?.name ?? "our team";

    const match = await getCampaignForReply(args.orgId, email);
    if (!match) return;
    const campaign = match.campaign;

    // Thread context for the guardrails: prior AI sends + recency of our last
    // outbound (loop guard).
    const { data: thread } = await supabaseAdmin
      .from("inbox_threads")
      .select("last_outbound_at, intent")
      .eq("id", args.threadId)
      .eq("org_id", args.orgId)
      .maybeSingle();
    const { count: priorAiReplies } = await supabaseAdmin
      .from("ai_sdr_replies")
      .select("id", { count: "exact", head: true })
      .eq("org_id", args.orgId)
      .eq("thread_id", args.threadId)
      .eq("status", "sent");
    const lastOut = (thread as { last_outbound_at: string | null } | null)?.last_outbound_at ?? null;
    const minutesSinceLastOutbound = lastOut ? (Date.now() - new Date(lastOut).getTime()) / 60_000 : null;

    const gate = evaluateAutoReply({
      campaign,
      intent: args.intent,
      confidence: args.confidence,
      interestLevel: args.interestLevel,
      priorAiReplies: priorAiReplies ?? 0,
      minutesSinceLastOutbound,
    });
    if (!gate.ok) return;

    // Grounding + who we're speaking as (the campaign's creator) + their
    // booking page and LIVE open slots, so the SDR can propose real times in
    // conversation and book the one the candidate agrees to.
    const [knowledge, recruiter, bookingLink] = await Promise.all([
      buildKnowledgeContext(args.orgId, campaign.id),
      getRecruiterIdentity(campaign.created_by),
      campaign.created_by ? getOrCreateBookingLink(args.orgId, campaign.created_by).catch(() => null) : Promise.resolve(null),
    ]);
    const bookingUrl = bookingLink?.active ? urlForBookingLink(bookingLink) : null;
    let openSlots: { iso: string; label: string }[] = [];
    if (bookingLink?.active) {
      const { slots } = await openSlotsForLink(bookingLink).catch(() => ({ slots: [] as string[] }));
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: bookingLink.timezone, weekday: "short", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
      });
      openSlots = slots.slice(0, 8).map((iso) => ({ iso, label: `${fmt.format(new Date(iso))} (${bookingLink.timezone})` }));
    }

    // Recent transcript for context.
    let msgs;
    if (args.applicationId) {
      const { data } = await supabaseAdmin
        .from("enterprise_messages")
        .select("direction, body, created_at")
        .eq("org_id", args.orgId).eq("application_id", args.applicationId)
        .order("created_at", { ascending: true }).limit(12);
      msgs = data;
    } else {
      const { data } = await supabaseAdmin
        .from("enterprise_messages")
        .select("direction, body, created_at")
        .eq("org_id", args.orgId)
        .or(`from_email.ilike.${email},to_email.ilike.${email}`)
        .order("created_at", { ascending: true }).limit(12);
      msgs = data;
    }
    const transcript: TranscriptMessage[] = ((msgs ?? []) as { direction: string; body: string | null }[])
      .map((m): TranscriptMessage => ({ direction: m.direction === "outbound" ? "outbound" : "inbound", body: m.body ?? "" }))
      .filter((m) => m.body.trim().length > 0);

    const draft = await draftAutoReply({
      orgId: args.orgId,
      campaign,
      knowledge,
      transcript,
      candidateName: args.candidateName ?? match.candidateName,
      orgName,
      recruiterName: recruiter.name,
      bookingUrl,
      openSlots,
    });
    if (!draft.body.trim()) return;

    // The model flagging needs_human forces review even in auto mode.
    const autoSend = gate.autoSend && !draft.needsHuman;
    const status = autoSend ? "queued" : "needs_review";
    const scheduledAt = autoSend ? scheduleAutoReply(campaign, new Date(), Math.random()).toISOString() : null;

    await supabaseAdmin.from("ai_sdr_replies").insert({
      org_id: args.orgId,
      thread_id: args.threadId,
      campaign_id: campaign.id,
      enrollment_id: match.enrollmentId,
      candidate_email: email,
      draft_subject: draft.subject || null,
      draft_body: draft.body,
      status,
      intent: args.intent,
      confidence: args.confidence,
      model: draft.model,
      input_tokens: draft.inputTokens,
      output_tokens: draft.outputTokens,
      scheduled_at: scheduledAt,
      book_slot: draft.bookSlot,
    });
  } catch (e) {
    console.error("[ai-sdr] enqueue failed", e);
  }
}

// Execute a draft's agreed booking right before its email goes out (cron auto-
// send or human approval). Books on the campaign creator's calendar; a taken
// slot returns ok=false so the caller can hold the email for review instead of
// sending a false confirmation.
export async function executeSdrBooking(reply: {
  org_id: string;
  campaign_id: string | null;
  enrollment_id: string | null;
  candidate_email: string;
  book_slot: string;
}): Promise<{ ok: boolean; taken?: boolean; meetLink?: string | null; error?: string }> {
  let creator: string | null = null;
  if (reply.campaign_id) {
    const { data } = await supabaseAdmin
      .from("enterprise_campaigns").select("created_by")
      .eq("id", reply.campaign_id).eq("org_id", reply.org_id).maybeSingle();
    creator = (data as { created_by?: string | null } | null)?.created_by ?? null;
  }
  if (!creator) return { ok: false, error: "No campaign creator to book on behalf of." };
  const link = await getOrCreateBookingLink(reply.org_id, creator);
  if (!link || !link.active) return { ok: false, error: "No active booking page." };

  let name = reply.candidate_email;
  if (reply.enrollment_id) {
    const { data } = await supabaseAdmin
      .from("enterprise_campaign_enrollments").select("candidate_name")
      .eq("id", reply.enrollment_id).maybeSingle();
    name = (data as { candidate_name?: string } | null)?.candidate_name || name;
  }
  return bookSlot(link, reply.book_slot, {
    name,
    email: reply.candidate_email,
    notes: "Booked by the AI SDR from the email conversation.",
  });
}
