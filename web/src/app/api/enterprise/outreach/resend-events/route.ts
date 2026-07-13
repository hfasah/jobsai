import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { audit } from "@/lib/enterprise-audit";
import { recordNegativeEvent, type MailboxRow } from "@/lib/outreach/deliverability";
import { isUsableStatus } from "@/lib/outreach/resend-domains";
import { normEmail } from "@/lib/sourcing/normalize";
import { suppressEmail } from "@/lib/outreach/suppression";

export const maxDuration = 30;

// Resend event webhook for the deliverability engine:
//   email.bounced / email.complained -> per-mailbox stats -> auto-pause rules
//   domain.updated                   -> sync sending_domains status/records
// Separate endpoint + secret (RESEND_EVENTS_WEBHOOK_SECRET) from the inbound
// email webhook so the two flows stay isolated.
function verifySignature(headers: Headers, rawBody: string): boolean {
  const secret = process.env.RESEND_EVENTS_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[outreach/resend-events] RESEND_EVENTS_WEBHOOK_SECRET not set — skipping verification");
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

interface ResendEvent {
  type?: string;
  data?: {
    // email.* events
    from?: string;
    to?: string[] | string;
    email_id?: string;
    bounce?: { type?: string; subType?: string };
    // domain.* events
    id?: string;
    name?: string;
    status?: string;
    records?: unknown[];
  };
}

// A bounce is worth suppressing only when it's permanent. Resend/SES surface a
// "Transient" type for soft bounces (mailbox full, throttled) — don't burn the
// address on those.
function isPermanentBounce(data: ResendEvent["data"]): boolean {
  const t = (data?.bounce?.type ?? "").toLowerCase();
  if (!t) return true; // no classification → treat email.bounced as permanent
  return t !== "transient" && t !== "soft" && t !== "undetermined";
}

function firstAddr(v: string[] | string | undefined): string | null {
  if (!v) return null;
  const raw = Array.isArray(v) ? v[0] : v;
  const m = raw?.match(/<([^>]+)>/);
  return normEmail(m ? m[1] : raw);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!verifySignature(req.headers, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const type = event.type ?? "";

  try {
    if (type === "email.bounced" || type === "email.complained") {
      const fromEmail = firstAddr(event.data?.from);
      const recipient = firstAddr(event.data?.to);

      // Map to the owning mailbox by sender address.
      let mailbox: MailboxRow | null = null;
      if (fromEmail) {
        const { data } = await supabaseAdmin
          .from("sending_mailboxes")
          .select("id, org_id, kind, address, status, paused_reason, ramp_started_at, daily_limit_cap")
          .eq("address", fromEmail)
          .maybeSingle();
        mailbox = data as MailboxRow | null;
      }

      await supabaseAdmin.from("outreach_events").insert({
        org_id: mailbox?.org_id ?? null,
        mailbox_id: mailbox?.id ?? null,
        event: type,
        recipient,
        from_email: fromEmail,
        payload: event.data ?? {},
      });

      if (mailbox) {
        await recordNegativeEvent(mailbox, type === "email.bounced" ? "bounce" : "complaint");

        // Suppress the RECIPIENT org-wide too — a permanent bounce or a spam
        // complaint means we must stop contacting that address in every campaign,
        // not just pause the sending mailbox. (Soft bounces are skipped.)
        const isComplaint = type === "email.complained";
        if (recipient && (isComplaint || isPermanentBounce(event.data))) {
          await suppressEmail({
            orgId: mailbox.org_id,
            email: recipient,
            reason: isComplaint ? "spam_complaint" : "hard_bounce",
            source: "resend_webhook",
            messageId: event.data?.email_id ?? null,
          });
        }
      }
    } else if (type === "domain.updated" || type === "domain.created") {
      const resendId = event.data?.id;
      const status = event.data?.status;
      if (resendId && status) {
        const { data } = await supabaseAdmin
          .from("sending_domains")
          .select("id, org_id, domain, status")
          .eq("resend_domain_id", resendId)
          .maybeSingle();
        const row = data as { id: string; org_id: string; domain: string; status: string } | null;
        if (row && row.status !== status) {
          await supabaseAdmin
            .from("sending_domains")
            .update({
              status,
              records: event.data?.records ?? undefined,
              last_checked_at: new Date().toISOString(),
              verified_at: isUsableStatus(status) ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id)
            .eq("org_id", row.org_id);
          if (isUsableStatus(status) && !isUsableStatus(row.status)) {
            audit({
              org_id: row.org_id,
              action: "outreach.domain_verified",
              resource_type: "sending_domain",
              resource_id: row.id,
              metadata: { domain: row.domain, status },
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("[outreach/resend-events] handler error", e);
    // 200 anyway — Resend retries would just re-fail; events are logged.
  }

  return NextResponse.json({ received: true });
}
