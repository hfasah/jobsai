import { NextRequest, NextResponse } from "next/server";
import { requireAdminPerm } from "@/lib/admin";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { recordUsage } from "@/lib/llm-usage";
import { GUIDE_ARTICLES } from "@/lib/enterprise-guide";

export const maxDuration = 30;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work").replace(/\/$/, "");

let _ai: OpenAI | null = null;
const ai = () => (_ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

async function requireAdmin() {
  const ctx = await requireAdminPerm("support");
  return ctx ? ctx.userId : null;
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
  const guideLinks = GUIDE_ARTICLES.map((a) => `${a.title}: ${APP_URL}/enterprise/guide/${a.slug}`).join("\n");

  try {
    const resp = await ai().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.5,
      max_tokens: 380,
      messages: [{
        role: "user",
        content:
          `You are a JobsAI Enterprise support agent drafting a reply for a human teammate to review and send. ` +
          `Be helpful, specific, and warm; address ${first} by name. Answer what you can from the conversation, ` +
          `but DO NOT invent prices, features, dates, or commitments — if unsure, say a teammate will confirm. ` +
          `When a How-To Guide article is relevant, include its full URL inline so the customer can self-serve. ` +
          `Plain text, under 160 words, no subject line.\n\n` +
          `Inquiry type: ${ticket.category ?? "general"}\nSubject: ${ticket.subject}\n\n` +
          `How-To Guide articles (Title: URL):\n${guideLinks}\nGuide home: ${APP_URL}/enterprise/guide\n\n` +
          `Conversation so far:\n${thread}`,
      }],
    });
    recordUsage({ feature: "support_draft", model: "gpt-4o-mini", usage: { prompt_tokens: resp.usage?.prompt_tokens, completion_tokens: resp.usage?.completion_tokens } });
    const draft = resp.choices[0]?.message?.content?.trim() ?? "";
    if (!draft) return NextResponse.json({ error: "Could not draft a reply." }, { status: 502 });
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("support AI draft failed", err);
    return NextResponse.json({ error: "AI draft failed." }, { status: 502 });
  }
}
