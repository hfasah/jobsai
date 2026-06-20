import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getAIClient } from "@/lib/ai-client";
import { AI_TIERS } from "@/lib/ai-models";
import { supabaseAdmin } from "@/lib/supabase";
import { recordUsage } from "@/lib/llm-usage";

export const maxDuration = 30;

let _ai: OpenAI | null = null;
const ai = () => (_ai ??= getAIClient(AI_TIERS.fast.provider));

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return adminIds.includes(userId) ? userId : null;
}

// POST — draft a suggested reply (NOT sent). The admin reviews/edits, then sends
// via the reply endpoint, keeping a human in the loop.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { ticketId } = await params;

  const { data: ticket } = await supabaseAdmin
    .from("support_tickets")
    .select("name, email, subject, message, category")
    .eq("id", ticketId)
    .single();
  if (!ticket) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: rows } = await supabaseAdmin
    .from("support_messages")
    .select("author, body")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  const thread = (rows ?? []).map((m) => `${m.author.toUpperCase()}: ${m.body}`).join("\n\n")
    || `CUSTOMER: ${ticket.message}`;
  const first = String(ticket.name).trim().split(/\s+/)[0] || ticket.name;

  try {
    const resp = await ai().chat.completions.create({
      model: AI_TIERS.fast.model,
      temperature: 0.5,
      max_tokens: 380,
      messages: [{
        role: "user",
        content:
          `You are a JobsAI Enterprise support agent drafting a reply for a human teammate to review and send. ` +
          `Be helpful, specific, and warm; address ${first} by name. Answer what you can from the conversation, ` +
          `but DO NOT invent prices, features, dates, or commitments — if unsure, say a teammate will confirm. ` +
          `Plain text, under 150 words, no subject line.\n\n` +
          `Inquiry type: ${ticket.category ?? "general"}\nSubject: ${ticket.subject}\n\n` +
          `Conversation so far:\n${thread}`,
      }],
    });
    recordUsage({ feature: "support_draft", model: AI_TIERS.fast.model, usage: { prompt_tokens: resp.usage?.prompt_tokens, completion_tokens: resp.usage?.completion_tokens } });
    const draft = resp.choices[0]?.message?.content?.trim() ?? "";
    if (!draft) return NextResponse.json({ error: "Could not draft a reply." }, { status: 502 });
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("support AI draft failed", err);
    return NextResponse.json({ error: "AI draft failed." }, { status: 502 });
  }
}
