import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { lookupAlias, findOurAlias } from "@/lib/apply-alias";
import { classifyEmail } from "@/lib/inbox";
import { advanceStageFromClass } from "@/lib/inbox-stage";
import { reclaimConfirmedApply } from "@/lib/agent-cost";
import { sendEmployerReplyCopy } from "@/lib/email";
import { createNotification } from "@/lib/notifications";

export const maxDuration = 30;

// Verify a Svix-signed webhook (Resend uses Svix). Returns true if valid or if
// no secret is configured (so the endpoint works before the secret is set).
function verifySignature(headers: Headers, rawBody: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[inbox/inbound] RESEND_WEBHOOK_SECRET not set — skipping verification");
    return true;
  }
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(`${id}.${ts}.${rawBody}`)
    .digest("base64");
  const expectedBuf = Buffer.from(expected);

  return sigHeader.split(" ").some((part) => {
    const sig = part.split(",")[1];
    if (!sig) return false;
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}

// "Jane Doe <jane@acme.com>" → { name, email }; bare "jane@acme.com" → { email }
function parseAddress(raw: string | null | undefined): { name: string | null; email: string } {
  const s = (raw ?? "").trim();
  const m = s.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  return { name: null, email: s.toLowerCase() };
}

interface ReceivedEmail {
  from?: string;
  to?: string[] | string;
  subject?: string;
  text?: string;
  html?: string;
}

// Fetch the full received email (the webhook only carries metadata).
async function fetchReceivedEmail(emailId: string): Promise<ReceivedEmail | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.error("[inbox/inbound] fetch received email failed:", res.status);
    return null;
  }
  return (await res.json()) as ReceivedEmail;
}

// POST /api/inbox/inbound — Resend inbound webhook (email.received)
export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!verifySignature(req.headers, raw)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.type !== "email.received") {
    return NextResponse.json({ ok: true, ignored: event.type ?? "unknown" });
  }

  const data = event.data ?? {};
  const emailId = (data.email_id ?? data.id) as string | undefined;
  const toList = ([] as string[])
    .concat((data.to as string[] | string) ?? [])
    .concat((data.cc as string[] | string) ?? []);

  // Which of our aliases received this?
  const alias = findOurAlias(Array.isArray(toList) ? toList : [String(toList)]);
  if (!alias) return NextResponse.json({ ok: true, ignored: "no-alias" });

  const owner = await lookupAlias(alias);
  if (!owner) return NextResponse.json({ ok: true, ignored: "unknown-alias" });

  // Pull full content (webhook payload is metadata-only).
  const full = emailId ? await fetchReceivedEmail(emailId) : null;
  const from = parseAddress((full?.from as string) ?? (data.from as string));
  const subject = full?.subject ?? (data.subject as string) ?? "";
  const bodyText = full?.text ?? (full?.html ? full.html.replace(/<[^>]+>/g, " ") : "") ?? "";

  const classification = classifyEmail(subject, bodyText);

  // Store in the inbox (idempotent on provider_message_id).
  const { error: insErr } = await supabaseAdmin.from("inbox_messages").insert({
    user_id: owner.user_id,
    direction: "inbound",
    from_email: from.email,
    from_name: from.name,
    to_email: alias,
    subject,
    body_text: bodyText,
    classification,
    job_id: owner.job_id,
    provider_message_id: emailId ?? null,
    received_at: new Date().toISOString(),
  });
  // Duplicate delivery → already processed; ack and stop.
  if (insErr?.code === "23505") return NextResponse.json({ ok: true, dedup: true });
  if (insErr) console.error("[inbox/inbound] insert failed:", insErr);

  // Move the pipeline card to reflect the reply.
  await advanceStageFromClass(owner.user_id, owner.job_id, classification).catch(() => {});

  // Revenue-leak fix: an employer "Application received" confirmation is ground
  // truth that the auto-apply succeeded. If Skyvern had reported it "failed" and
  // we refunded, reclaim that refund so a real application isn't billed as free.
  if (classification === "confirmation") {
    await reclaimConfirmedApply(owner.user_id, owner.job_id).catch(() => 0);
  }

  // Job label for the forward + notification.
  const { data: jp } = await supabaseAdmin
    .from("job_parsed")
    .select("title, company")
    .eq("job_id", owner.job_id)
    .maybeSingle();
  const jobTitle = jp?.title ?? "your application";
  const company = jp?.company ?? from.name ?? "the employer";

  // Forward a copy to the user's real inbox.
  await sendEmployerReplyCopy(owner.user_id, {
    jobTitle,
    company,
    fromName: from.name,
    fromEmail: from.email,
    subject,
    bodyText,
  }).catch((e) => console.error("[inbox/inbound] forward failed:", e));

  const notifTitle =
    classification === "interview"
      ? "Interview reply received 🎉"
      : classification === "rejection"
        ? "Application update"
        : `Reply from ${company}`;
  createNotification(
    owner.user_id,
    classification === "interview" ? "interview" : "employer_reply",
    notifTitle,
    `${from.name || from.email} replied about ${jobTitle}: "${subject}".`,
    { job_id: owner.job_id }
  ).catch(() => {});

  return NextResponse.json({ ok: true, classification });
}
