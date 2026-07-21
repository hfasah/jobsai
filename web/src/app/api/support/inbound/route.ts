import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { resend, FROM_SUPPORT, SUPPORT_EMAIL, REPLY_TO_SUPPORT } from "@/lib/resend";
import { wrapEmail } from "@/lib/email-utils";

export const maxDuration = 30;

// Support emails forwarded from support@jobsai.work (one.com) land on the Resend
// receiving subdomain (SUPPORT_INTAKE_DOMAIN, e.g. help.jobsai.work). This
// webhook logs them into support_tickets/support_messages (visible in the admin
// Support Inbox) and sends a branded "we'll reply within 24 hours" acknowledgment.

const INTAKE_DOMAIN = process.env.SUPPORT_INTAKE_DOMAIN || "help.jobsai.work";

// Verify the Svix-signed Resend webhook. Skips when no secret is set yet, so the
// endpoint works before the secret is wired up.
function verifySignature(headers: Headers, rawBody: string): boolean {
  const secret = process.env.SUPPORT_WEBHOOK_SECRET || process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[support/inbound] no webhook secret set — skipping verification");
    return true;
  }
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", secretBytes).update(`${id}.${ts}.${rawBody}`).digest("base64");
  const expectedBuf = Buffer.from(expected);
  return sigHeader.split(" ").some((part) => {
    const sig = part.split(",")[1];
    if (!sig) return false;
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}

interface ReceivedEmail { from?: string; to?: string[] | string; subject?: string; text?: string; html?: string }

async function fetchReceivedEmail(emailId: string): Promise<ReceivedEmail | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) { console.error("[support/inbound] fetch received email failed:", res.status); return null; }
  return (await res.json()) as ReceivedEmail;
}

// "Jane Doe <jane@acme.com>" → { name, email }; bare "jane@acme.com" → { email }.
function parseAddress(raw: string | null | undefined): { name: string | null; email: string } {
  const s = (raw ?? "").trim();
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  return { name: null, email: s.toLowerCase() };
}

// Mail-system / forwarding-provider domains whose automated mail (e.g. one.com's
// "verify email forward" bot) should never receive an auto-reply.
const MAIL_SYSTEM_DOMAINS = ["one.com", "amazonses.com", "amazonaws.com", "sendgrid.net", "mailgun.org"];

// Automated senders: no ticket and no auto-reply (avoids mail loops with
// no-reply addresses, mailer-daemons, verification bots, forwarding-confirmation
// bots, or ourselves). Covers jobsai.work subdomains (send./help./talent.) too —
// our own outbound must never open a ticket.
function isAutomatedSender(email: string): boolean {
  return /(^|[._-])(no[._-]?reply|do[._-]?not[._-]?reply|donotreply|mailer[-_]?daemon|postmaster|bounce|notifications?|forward(ing)?[._-]?(verification|confirm)?)@/i.test(email)
    || /verification[._-]?reply/i.test(email)
    || email.endsWith("@jobsai.work")
    || email.endsWith(".jobsai.work")
    || email.endsWith(`@${INTAKE_DOMAIN}`)
    || MAIL_SYSTEM_DOMAINS.some((d) => email === `@${d}` || email.endsWith(`@${d}`) || email.endsWith(`.${d}`));
}

// Bounce reports and auto-generated mail must not become tickets; neither should
// our own acknowledgment when the support@ forward loops it back to the intake.
const JUNK_SUBJECT_RE = /^(undeliverable[:\s]|mail delivery fail|delivery status notification|returned mail|failure notice|auto[-\s]?reply|automatic reply|out of office)/i;
const OWN_ACK_PREFIX = "We've received your message";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifySignature(req.headers, raw)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: Record<string, unknown> };
  try { event = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (event.type !== "email.received") return NextResponse.json({ ok: true, ignored: event.type ?? "unknown" });

  const data = event.data ?? {};
  const emailId = (data.email_id ?? data.id) as string | undefined;
  const toList = ([] as string[])
    .concat((data.to as string[] | string) ?? [])
    .concat((data.cc as string[] | string) ?? [])
    .concat((data.received_for as string[] | string) ?? [])
    .flat().map(String);

  // Only act on mail delivered to our support intake subdomain.
  const matched = toList.some((addr) => parseAddress(addr).email.endsWith(`@${INTAKE_DOMAIN}`));
  if (!matched) return NextResponse.json({ ok: true, ignored: "not-support-intake" });

  const full = emailId ? await fetchReceivedEmail(emailId) : null;
  const sender = parseAddress((full?.from as string) ?? (data.from as string));
  const subject = (full?.subject ?? (data.subject as string) ?? "(no subject)").trim() || "(no subject)";
  const bodyText = (full?.text ?? (full?.html ? full.html.replace(/<[^>]+>/g, " ") : "") ?? "").trim();
  const senderName = sender.name ?? sender.email.split("@")[0];

  // Automated mail (bounces, system notices, our own ack looping back) never
  // becomes a ticket — it buries real customers and trips the health sweep.
  if (isAutomatedSender(sender.email) || JUNK_SUBJECT_RE.test(subject) || subject.startsWith(OWN_ACK_PREFIX)) {
    console.log(`[support/inbound] skipped automated mail from ${sender.email}: ${subject}`);
    return NextResponse.json({ ok: true, ignored: "automated-mail" });
  }

  // Create a support ticket + log the inbound message (shows in admin Support Inbox).
  const { data: ticket, error } = await supabaseAdmin
    .from("support_tickets")
    .insert({
      name: senderName, email: sender.email, subject, message: bodyText || "(empty body)",
      category: "general", status: "open",
    })
    .select("id").single();
  if (error) { console.error("[support/inbound] ticket insert failed:", error.message); return NextResponse.json({ ok: true, error: "ticket-failed" }); }

  await supabaseAdmin.from("support_messages").insert({
    ticket_id: ticket.id, direction: "inbound", author: "customer",
    subject, body: bodyText || "(empty body)", email_from: sender.email, email_to: SUPPORT_EMAIL,
  });

  // Branded acknowledgment — skip for automated senders to avoid loops.
  if (sender.email && !isAutomatedSender(sender.email)) {
    const ref = ticket.id.slice(0, 8);
    const firstName = senderName.split(/\s+/)[0];
    const ackHtml = wrapEmail(
      `<p style="font-size:18px;font-weight:700;margin:0 0 4px">Thanks for reaching out to JobsAI 👋</p>
       <p style="margin:16px 0 0">Hi ${firstName},</p>
       <p style="margin:12px 0 0">We've received your message and a member of our support team will get back to you <strong>within 24 hours</strong> (Monday–Friday). We read every email personally, so there's nothing more you need to do — we'll follow up shortly.</p>
       <p style="margin:12px 0 0">For your reference, your ticket number is <strong>#${ref}</strong>.</p>
       <p style="margin:20px 0 0">Warm regards,<br/>The JobsAI Support Team</p>`,
      false,
    );
    const ackSubject = `We've received your message — JobsAI Support [#${ref}]`;
    const sent = await resend.emails.send({
      from: FROM_SUPPORT, to: sender.email, replyTo: REPLY_TO_SUPPORT, subject: ackSubject, html: ackHtml,
    }).catch((e) => { console.error("[support/inbound] ack send failed:", e); return null; });

    if (sent) {
      await supabaseAdmin.from("support_messages").insert({
        ticket_id: ticket.id, direction: "outbound", author: "ai",
        subject: ackSubject, body: "Automated acknowledgment — we'll reply within 24 hours.",
        email_from: SUPPORT_EMAIL, email_to: sender.email,
      });
    }
  }

  return NextResponse.json({ ok: true, ticket_id: ticket.id });
}
