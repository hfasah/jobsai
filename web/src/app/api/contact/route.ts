import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase";
import { resend, FROM_SUPPORT, SUPPORT_EMAIL, REPLY_TO_SUPPORT } from "@/lib/resend";
import { createRateLimiter, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { recordUsage } from "@/lib/llm-usage";
import { linkifyHtml } from "@/lib/email-utils";
import { GUIDE_ARTICLES } from "@/lib/enterprise-guide";

export const maxDuration = 30;

const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 }); // 5/10 min

let _ai: OpenAI | null = null;
const ai = () => (_ai ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY }));

// Point each inquiry type at a relevant resource the reply can link to.
const RESOURCE_BY_CATEGORY: Record<string, { label: string; path: string }> = {
  enterprise_sales: { label: "pricing", path: "/enterprise/pricing" },
  enterprise_demo: { label: "book a demo", path: "/enterprise/demo" },
  enterprise_partnership: { label: "our platform overview", path: "/enterprise/home" },
  enterprise_support: { label: "the guide", path: "/enterprise/guide" },
  enterprise_billing: { label: "pricing & plans", path: "/enterprise/pricing" },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work").replace(/\/$/, "");

// Draft a warm, personalized acknowledgment. Honest — it acknowledges and points
// to a relevant resource; it does not promise specifics or pretend to be human.
async function draftReply(opts: {
  name: string; email: string; subject?: string; message: string; category?: string;
}): Promise<{ subject: string; bodyText: string; bodyHtml: string }> {
  const first = opts.name.trim().split(/\s+/)[0] || opts.name;
  const resource = opts.category ? RESOURCE_BY_CATEGORY[opts.category] : undefined;
  const resourceLine = resource ? `${APP_URL}${resource.path} (${resource.label})` : "";
  const guideLinks = GUIDE_ARTICLES.map((a) => `${a.title}: ${APP_URL}/enterprise/guide/${a.slug}`).join("\n");
  const toHtml = (text: string) =>
    `<p>${linkifyHtml(escapeHtml(text)).replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br/>")}</p>`;

  const fallbackSubject = "Thanks for reaching out to JobsAI Enterprise";
  const fallbackText =
    `Hi ${first},\n\nThanks for reaching out — we've received your message and a member of our team will follow up personally within one business day.` +
    (resource ? `\n\nIn the meantime, you might find this helpful: ${APP_URL}${resource.path} (${resource.label}).` : "") +
    `\n\nTalk soon,\nThe JobsAI Enterprise team`;

  try {
    const resp = await ai().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      max_tokens: 320,
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content:
          `Write a warm, concise acknowledgment email from the JobsAI Enterprise team to someone who just submitted our contact form. ` +
          `Address them by first name (${first}). Reflect their specific inquiry so it feels personal, but DO NOT invent facts, prices, or commitments. ` +
          `Make clear a human teammate will follow up within one business day. Keep it under 130 words, friendly and professional.` +
          (resourceLine ? ` Naturally include this link as a helpful resource: ${resourceLine}.` : "") +
          ` If a How-To Guide article below is clearly relevant to their question, include its full URL inline so they can self-serve.` +
          `\n\nTheir inquiry type: ${opts.category ?? "general"}` +
          `\nSubject: ${opts.subject || "(none)"}` +
          `\nMessage: ${opts.message}` +
          `\n\nHow-To Guide articles (Title: URL):\n${guideLinks}` +
          `\nGuide home: ${APP_URL}/enterprise/guide` +
          `\n\nReturn JSON: { "subject": "...", "body": "plain text, use \\n for line breaks; include any URLs in full" }`,
      }],
    });
    const parsed = JSON.parse(resp.choices[0]?.message?.content ?? "{}");
    recordUsage({ feature: "contact_autoreply", model: "gpt-4o-mini", usage: { prompt_tokens: resp.usage?.prompt_tokens, completion_tokens: resp.usage?.completion_tokens } });
    if (parsed.subject && parsed.body) {
      const bodyText = String(parsed.body).trim();
      return { subject: String(parsed.subject), bodyText, bodyHtml: toHtml(bodyText) };
    }
  } catch (err) {
    console.error("contact auto-reply AI draft failed", err);
  }
  return { subject: fallbackSubject, bodyText: fallbackText, bodyHtml: toHtml(fallbackText) };
}

export async function POST(req: NextRequest) {
  const rl = limiter(getClientIp(req));
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);
  const body = await req.json().catch(() => ({}));
  const { name, email, subject, message, category } = body as Record<string, string>;

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email and message are required." }, { status: 400 });
  }

  // Save to support_tickets table
  const { data: ticket, error } = await supabaseAdmin
    .from("support_tickets")
    .insert({
      name, email,
      subject: subject || "(no subject)",
      message,
      category: category || "general",
      status: "open",
      last_inbound_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("support_tickets insert error", error);
    return NextResponse.json({ error: "Failed to submit ticket." }, { status: 500 });
  }

  const ticketRef = ticket.id.slice(0, 8);

  // Log the inbound message to the thread (best-effort).
  supabaseAdmin.from("support_messages").insert({
    ticket_id: ticket.id, direction: "inbound", author: "customer",
    subject: subject || "(no subject)", body: message, email_from: email, email_to: SUPPORT_EMAIL,
  }).then(() => {}, (e) => console.error("support_messages inbound insert", e));

  // Notify admin
  const adminSend = resend.emails.send({
    from: FROM_SUPPORT,
    to: SUPPORT_EMAIL,
    replyTo: email,
    subject: `[Support #${ticketRef}] ${subject || message.slice(0, 60)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#6d28d9">New contact submission</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#888;width:100px">From</td><td>${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</td></tr>
          <tr><td style="padding:6px 0;color:#888">Category</td><td>${escapeHtml(category || "General")}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Ticket ID</td><td>#${ticketRef}</td></tr>
        </table>
        <div style="margin-top:16px;background:#f5f3ff;padding:16px;border-radius:8px">
          <p style="margin:0;white-space:pre-wrap">${escapeHtml(message)}</p>
        </div>
      </div>
    `,
  });

  // AI-personalized auto-reply to the submitter
  const reply = await draftReply({ name, email, subject, message, category });
  const userSend = resend.emails.send({
    from: FROM_SUPPORT,
    to: email,
    replyTo: REPLY_TO_SUPPORT,
    subject: reply.subject,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#0f172a;font-size:15px;line-height:1.6">
        ${reply.bodyHtml}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#888;font-size:12px">JobsAI Enterprise &middot; support@jobsai.work &middot; Ref #${ticketRef}</p>
      </div>
    `,
  });

  // Log the AI auto-reply to the thread (best-effort).
  supabaseAdmin.from("support_messages").insert({
    ticket_id: ticket.id, direction: "outbound", author: "ai",
    subject: reply.subject, body: reply.bodyText, email_from: "support@send.jobsai.work", email_to: email,
  }).then(() => {}, (e) => console.error("support_messages ai insert", e));

  // Surface delivery results in logs. Resend returns an { error } object (it does
  // not throw) when the key is missing or the sending domain isn't verified, so
  // failures would otherwise be invisible.
  const [adminRes, userRes] = await Promise.allSettled([adminSend, userSend]);
  const sendError = (r: PromiseSettledResult<{ error?: unknown }>) =>
    r.status === "rejected" ? r.reason : (r.value?.error ?? null);
  const adminErr = sendError(adminRes);
  const userErr = sendError(userRes);
  if (adminErr) console.error("contact admin email failed", adminErr);
  if (userErr) console.error("contact auto-reply email failed", userErr);

  return NextResponse.json({
    ok: true,
    ticketId: ticket.id,
    emailed: !userErr, // false ⇒ check RESEND_API_KEY + verified sending domain
  });
}
