import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireFeature } from "@/lib/enterprise-entitlements";
import { getMyOrg } from "@/lib/enterprise";
import { isEmailSuppressed } from "@/lib/outreach/suppression";
import { INTENTS, deriveInterest, type Intent } from "@/lib/outreach/intent";
import { getCampaignForReply } from "@/lib/outreach/ai-sdr";

async function loadThread(orgId: string, id: string) {
  const { data } = await supabaseAdmin
    .from("inbox_threads")
    .select("id, candidate_email, candidate_name, application_id, intent, intent_confidence, intent_manual, interest_score, interest_level, ai_summary, status, outcome, ai_sdr_disabled, assignee_user_id, last_inbound_at, last_outbound_at, reply_count, unread")
    .eq("id", id)
    .eq("org_id", orgId)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

// GET — thread + its full message history (from enterprise_messages, joined by
// application_id when known, else by candidate email). Marks the thread read.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "outreach_campaigns");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await ctx.params;
  const thread = await loadThread(org.id, id);
  if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });

  // Messages: application-linked rows AND email-matched rows, unioned. The old
  // either/or blanked the history the moment a thread gained an application_id
  // (the interested-intent auto-action links one) because earlier messages were
  // logged by email only, with a null application_id.
  const email = thread.candidate_email as string;
  const ors = [`from_email.ilike.${email}`, `to_email.ilike.${email}`];
  if (thread.application_id) ors.push(`application_id.eq.${thread.application_id}`);
  const { data: messages } = await supabaseAdmin
    .from("enterprise_messages")
    .select("id, direction, from_email, to_email, subject, body, created_at, sent_via")
    .eq("org_id", org.id)
    .or(ors.join(","))
    .order("created_at", { ascending: true })
    .limit(200);

  if (thread.unread) {
    await supabaseAdmin.from("inbox_threads").update({ unread: false }).eq("id", id).eq("org_id", org.id);
    thread.unread = false;
  }

  // Live DNC state — the intent chip can say anything while the contact is
  // still suppressed underneath; the UI needs the truth to offer the Undo.
  const suppressed = await isEmailSuppressed(org.id, thread.candidate_email as string);

  // Will the AI actually answer the next reply on this thread? Resolve the
  // same gates the enqueue path checks so the UI can show an honest
  // "Auto-reply on / drafts only / OFF (why)" chip instead of leaving the
  // recruiter guessing why no reply went out.
  let aiReply: { state: "auto" | "draft" | "off"; reason: string } = { state: "off", reason: "No active campaign with AI SDR covers this contact." };
  const { data: orgRow } = await supabaseAdmin
    .from("enterprise_orgs").select("ai_sdr_paused").eq("id", org.id).maybeSingle();
  if ((orgRow as { ai_sdr_paused?: boolean } | null)?.ai_sdr_paused) {
    aiReply = { state: "off", reason: "AI SDR is paused for the whole workspace (Settings)." };
  } else if (thread.ai_sdr_disabled) {
    aiReply = { state: "off", reason: "AI SDR is disabled on this thread — set the status chip to something else to re-enable." };
  } else {
    const match = await getCampaignForReply(org.id, email).catch(() => null);
    if (match) {
      const c = match.campaign as { name?: string | null; ai_sdr_mode?: string | null };
      aiReply = c.ai_sdr_mode === "auto"
        ? { state: "auto", reason: `Auto-reply is on (campaign "${c.name ?? "…"}").` }
        : { state: "draft", reason: `Drafts only — replies wait for your approval (campaign "${c.name ?? "…"}").` };
    }
  }

  return NextResponse.json({ data: { thread, messages: messages ?? [], suppressed, ai_reply: aiReply } });
}

// PATCH — operator actions on a thread:
//   { intent }                       manual intent override (sets intent_manual)
//   { status: open|snoozed|done }
//   { assignee_user_id | "me" | null }
//   { unread: boolean }
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = await requireFeature(userId, "outreach_campaigns");
  if (gate) return gate;
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await ctx.params;
  const thread = await loadThread(org.id, id);
  if (!thread) return NextResponse.json({ error: "Thread not found." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.intent === "string" && INTENTS.includes(body.intent as Intent)) {
    patch.intent = body.intent;
    patch.intent_manual = true;
    patch.intent_confidence = 1;
    // Keep the warmth signal consistent with the human's label: re-derive the
    // interest bucket from the chosen intent (floors/caps applied), seeding from
    // the existing score so a manual "interested" doesn't drop below its floor.
    const seed = typeof thread.interest_score === "number" ? thread.interest_score : 50;
    const { interestScore, interestLevel } = deriveInterest(body.intent as Intent, seed);
    patch.interest_score = interestScore;
    patch.interest_level = interestLevel;
  }
  if (typeof body.status === "string" && ["open", "snoozed", "done"].includes(body.status)) {
    patch.status = body.status;
  }
  // Outcome chip (Meeting Booked / Manual Reply / AI SDR Disabled / none).
  // Choosing "AI SDR Disabled" also gates auto-replies on this thread; choosing
  // anything else re-enables them.
  if ("outcome" in body && (body.outcome === null || ["meeting_booked", "manual_reply", "ai_sdr_disabled"].includes(body.outcome as string))) {
    patch.outcome = body.outcome;
    patch.ai_sdr_disabled = body.outcome === "ai_sdr_disabled";
  }
  if ("assignee_user_id" in body) {
    patch.assignee_user_id = body.assignee_user_id === "me" ? userId : (body.assignee_user_id || null);
  }
  if (typeof body.unread === "boolean") patch.unread = body.unread;

  if (Object.keys(patch).length === 1) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  await supabaseAdmin.from("inbox_threads").update(patch).eq("id", id).eq("org_id", org.id);
  return NextResponse.json({ data: { updated: true } });
}
