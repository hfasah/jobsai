import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifySvix } from "@/lib/svix";

export const maxDuration = 15;

// Inbound email webhook (Resend Inbound). When a customer replies to a support
// email, the reply is parsed by Resend and POSTed here (Svix-signed). We match
// it back to its ticket and append it to the thread so the whole conversation
// stays in the admin portal.
//
// Setup required (one-time, outside code):
//   1. In Resend, add an Inbound endpoint pointing at
//      https://app.jobsai.work/api/webhooks/inbound-email
//   2. Set RESEND_INBOUND_WEBHOOK_SECRET (the whsec_… signing secret) on the
//      enterprise Vercel project.
//   3. Add the MX record Resend gives you so replies to support@jobsai.work
//      (or your inbound address) route to Resend.

function extractEmail(s: string): string {
  const m = s.match(/<([^>]+)>/);
  const raw = (m ? m[1] : s).trim();
  return raw.toLowerCase();
}
function extractName(s: string): string {
  const m = s.match(/^\s*"?([^"<]+?)"?\s*</);
  return m ? m[1].trim() : "";
}
function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}
// Trim quoted reply history so the thread shows just the new message.
function newReplyOnly(text: string): string {
  const cut = text.search(/\n\s*(On .+wrote:|-{2,}\s*Original Message|From:\s.+@)/);
  return (cut > 0 ? text.slice(0, cut) : text).trim();
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  // Require a configured signing secret — never accept unsigned inbound mail.
  const secret = process.env.RESEND_INBOUND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[inbound-email] RESEND_INBOUND_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (!verifySvix(secret, req.headers, raw)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad payload" }, { status: 400 }); }

  // Only handle inbound mail. If this endpoint also receives delivery events
  // (sent/delivered/bounced), ignore them.
  const eventType = typeof payload.type === "string" ? payload.type : undefined;
  if (eventType && eventType !== "email.received" && eventType !== "inbound.email") {
    return NextResponse.json({ ok: true, skipped: `event ${eventType}` });
  }

  // Resend wraps the email in { type, data }; tolerate a flat payload too.
  const data = (payload.data ?? payload) as Record<string, unknown>;

  const fromField = data.from ?? data.sender ?? "";
  const fromStr = typeof fromField === "string" ? fromField : String((fromField as { address?: string })?.address ?? "");
  const sender = extractEmail(fromStr);
  const senderName = extractName(fromStr) || sender;

  const toField = data.to ?? "";
  const toStr = Array.isArray(toField)
    ? String((toField[0] as { address?: string })?.address ?? toField[0] ?? "")
    : (typeof toField === "string" ? toField : String((toField as { address?: string })?.address ?? ""));

  const subject = String(data.subject ?? "").trim();
  const rawText = String(data.text ?? data.plain ?? (data.html ? stripHtml(String(data.html)) : "")).trim();
  const bodyText = newReplyOnly(rawText) || rawText || "(no text content)";

  if (!sender) return NextResponse.json({ ok: true, skipped: "no sender" });

  // Loop guard: ignore mail from our own domain / automated senders.
  if (sender.endsWith("@jobsai.work") || /(^|<)(no-?reply|mailer-daemon|postmaster)@/i.test(fromStr)) {
    return NextResponse.json({ ok: true, skipped: "self/automated" });
  }

  // Match to a ticket: prefer the #ref embedded in the reply subject, else the
  // sender's most recent ticket.
  const refMatch = subject.match(/#([0-9a-f]{8})\b/i);
  const ref = refMatch?.[1]?.toLowerCase();

  let ticket: { id: string } | null = null;

  const { data: byEmail } = await supabaseAdmin
    .from("support_tickets")
    .select("id, created_at")
    .eq("email", sender)
    .order("created_at", { ascending: false })
    .limit(25);

  if (ref && byEmail) ticket = byEmail.find((t) => String(t.id).toLowerCase().startsWith(ref)) ?? null;
  if (!ticket && byEmail && byEmail.length > 0) ticket = byEmail[0];
  if (!ticket && ref) {
    const { data: recent } = await supabaseAdmin
      .from("support_tickets")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(300);
    ticket = recent?.find((t) => String(t.id).toLowerCase().startsWith(ref)) ?? null;
  }

  // No match → turn the inbound email into a new ticket.
  if (!ticket) {
    const { data: created, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        name: senderName,
        email: sender,
        subject: subject || "(no subject)",
        message: bodyText,
        category: "email",
        status: "open",
        last_inbound_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !created) {
      console.error("[inbound-email] failed to create ticket", error);
      return NextResponse.json({ error: "Could not create ticket" }, { status: 500 });
    }
    await supabaseAdmin.from("support_messages").insert({
      ticket_id: created.id, direction: "inbound", author: "customer",
      subject: subject || "(no subject)", body: bodyText, email_from: sender, email_to: toStr,
    });
    return NextResponse.json({ ok: true, ticketId: created.id, created: true });
  }

  // Append to the existing thread and reopen the ticket.
  await supabaseAdmin.from("support_messages").insert({
    ticket_id: ticket.id, direction: "inbound", author: "customer",
    subject: subject || "(no subject)", body: bodyText, email_from: sender, email_to: toStr,
  });
  await supabaseAdmin.from("support_tickets")
    .update({ status: "open", last_inbound_at: new Date().toISOString() })
    .eq("id", ticket.id);

  return NextResponse.json({ ok: true, ticketId: ticket.id });
}
