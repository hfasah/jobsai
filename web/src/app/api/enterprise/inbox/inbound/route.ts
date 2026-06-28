import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { extractText } from "@/lib/resume-extractor";
import { parseResumeText } from "@/lib/resume-parser";
import { supabaseAdmin } from "@/lib/supabase";
import {
  resolveIntakeOrg, getOrCreateIntakePool, createIntakeApplication, parseAddress, firstEmail, storeResumeFile,
} from "@/lib/enterprise-intake-inbox";
import { parseJobFromText, createDraftJobFromParsed, classifyIntakeEmail } from "@/lib/job-intake";

// True when the email was sent to a job-intake sub-address (<handle>+jobs@…),
// i.e. a hiring-manager job request rather than a candidate resume.
function isJobIntake(toList: string[]): boolean {
  return toList.some((addr) => /\+jobs?\b/i.test(parseAddress(addr).email.split("@")[0]));
}

export const maxDuration = 60;

// Verify the Svix-signed Resend webhook. Returns true if valid (or if no secret
// is configured yet, so the endpoint works before the secret is wired up).
function verifySignature(headers: Headers, rawBody: string): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[enterprise/inbound] RESEND_WEBHOOK_SECRET not set — skipping verification");
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

interface Attachment { filename?: string; content_type?: string; content?: string; content_url?: string }
interface ReceivedEmail {
  from?: string; to?: string[] | string; subject?: string; text?: string; html?: string;
  attachments?: Attachment[];
}

async function fetchReceivedEmail(emailId: string): Promise<ReceivedEmail | null> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // Without the API key we can't pull the body/attachments — only metadata
    // arrives in the webhook — so emailed resumes land as empty candidates.
    console.warn("[enterprise/inbound] RESEND_API_KEY not set — body & attachments cannot be fetched; resumes will not be parsed.");
    return null;
  }
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) { console.error("[enterprise/inbound] fetch received email failed:", res.status); return null; }
  return (await res.json()) as ReceivedEmail;
}

// Resume MIME types we can extract text from.
function isResume(a: Attachment): boolean {
  const t = (a.content_type ?? "").toLowerCase();
  const n = (a.filename ?? "").toLowerCase();
  return (
    t === "application/pdf" ||
    t === "application/msword" ||
    t === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    n.endsWith(".pdf") || n.endsWith(".doc") || n.endsWith(".docx")
  );
}

function mimeFor(a: Attachment): string {
  const n = (a.filename ?? "").toLowerCase();
  if (a.content_type && a.content_type !== "application/octet-stream") return a.content_type;
  if (n.endsWith(".pdf")) return "application/pdf";
  if (n.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (n.endsWith(".doc")) return "application/msword";
  return a.content_type ?? "";
}

const decodeEntities = (s: string) =>
  s.replace(/&amp;/gi, "&").replace(/&#3[49];/g, '"').replace(/&quot;/gi, '"').replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");

// Detect a mailbox-forwarding verification email from ANY provider (Gmail,
// Microsoft 365, one.com, cPanel, etc.). When an org forwards its hr@ mailbox to
// the intake address, the host emails a confirmation code and/or a verify link
// here. We surface it in Settings -> Intake rather than parsing it into a junk
// candidate. Returns null for ordinary candidate mail.
function parseForwardingConfirmation(
  senderEmail: string, subject: string, bodyText: string, bodyHtml: string,
): { code: string; link: string | null; from: string | null } | null {
  const haystack = `${subject}\n${bodyText}`;
  // Require both a "forward" signal and a "confirm/verify" signal so ordinary
  // candidate mail isn't swallowed.
  const looksLikeConfirm =
    /forwarding[- ]?(confirmation|request|verification)/i.test(subject) ||
    (/forward/i.test(haystack) && /(confirm|verif|approve|activate|validate)/i.test(haystack));
  if (!looksLikeConfirm) return null;

  // Code (optional — many hosts use a link only). Google: "(#NNNNN)" or
  // "confirmation code: NNNN"; generic: "code: NNNN".
  const codeMatch =
    haystack.match(/(?:confirmation|verification)\s*code[:\s(#]*?(\d{5,12})/i) ||
    subject.match(/\(#\s*(\d{5,12})\)/) ||
    haystack.match(/\bcode[:\s]+(\d{5,12})\b/i) ||
    haystack.match(/\b(\d{9})\b/);

  // Verify link (optional): prefer a URL that looks like a confirm/verify link,
  // else a known host, else the first link in a message we've already judged to
  // be a forwarding confirmation.
  const urls = decodeEntities(`${bodyHtml} ${bodyText}`).match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  const link =
    urls.find((u) => /(confirm|verif|forward|approve|activate|validate)/i.test(u)) ||
    urls.find((u) => /mail\.google\.com|one\.com|webmail/i.test(u)) ||
    urls[0] ||
    null;

  // Need at least one actionable piece, or it's not a usable confirmation.
  if (!codeMatch && !link) return null;

  const fromMatch =
    subject.match(/Receive Mail from\s+([^\s)<>"]+@[^\s)<>"]+)/i) ||
    haystack.match(/forward\b[\s\S]{0,80}?(?:from|of)\s+([^\s)<>"]+@[^\s)<>"]+)/i);

  return {
    code: codeMatch ? codeMatch[1] : "",
    link: link ? link.replace(/["'>).,]+$/, "") : null,
    from: fromMatch ? fromMatch[1].toLowerCase() : null,
  };
}

async function attachmentBuffer(a: Attachment): Promise<Buffer | null> {
  if (a.content) { try { return Buffer.from(a.content, "base64"); } catch { return null; } }
  if (a.content_url) {
    try {
      const r = await fetch(a.content_url);
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    } catch { return null; }
  }
  return null;
}

// POST /api/enterprise/inbox/inbound — Resend inbound webhook (email.received).
// Candidates email their resume to <handle>@apply.jobsai.work (or the org
// forwards from its own hr@ mailbox); we create an inbox application from the
// resume attachment. Only acts on the enterprise intake domain — other inbound
// mail (e.g. the consumer job-seeker inbox) is ignored here.
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
  // Include received_for (the envelope recipient) — for forwarded mail the To:
  // header can still be the original mailbox, while received_for is the address
  // the message was actually delivered to (our intake address).
  const toList = ([] as string[])
    .concat((data.to as string[] | string) ?? [])
    .concat((data.cc as string[] | string) ?? [])
    .concat((data.received_for as string[] | string) ?? [])
    .flat()
    .map(String);

  const org = await resolveIntakeOrg(toList);
  if (!org) return NextResponse.json({ ok: true, ignored: "no-intake-match" });

  const full = emailId ? await fetchReceivedEmail(emailId) : null;
  // If we had an email id but couldn't pull the full message, the body and any
  // resume attachment are unavailable — surfaced in the response so the Resend
  // event log explains why a candidate has no resume (usually RESEND_API_KEY).
  const couldNotFetchFull = !!emailId && !full;
  const fromRaw = (full?.from as string) ?? (data.from as string);
  const sender = parseAddress(fromRaw);
  const subject = full?.subject ?? (data.subject as string) ?? "";
  const bodyHtml = full?.html ?? "";
  const bodyText = full?.text ?? (bodyHtml ? bodyHtml.replace(/<[^>]+>/g, " ") : "") ?? "";

  // Forwarding-confirmation email from Google? Capture the code/link for the
  // Intake settings page and stop — don't create a candidate from it.
  const confirm = parseForwardingConfirmation(fromRaw ?? sender.email, subject, bodyText, bodyHtml);
  if (confirm) {
    await supabaseAdmin
      .from("enterprise_orgs")
      .update({
        intake_forward_code: confirm.code,
        intake_forward_link: confirm.link,
        intake_forward_from: confirm.from,
        intake_forward_at: new Date().toISOString(),
      })
      .eq("id", org.id);
    return NextResponse.json({ ok: true, forwarding_confirmation: true });
  }

  // Resume text + original file: from the first usable resume attachment.
  let resumeText = "";
  let resumeStorageKey: string | null = null;
  const attachments = full?.attachments ?? [];
  for (const a of attachments) {
    if (!isResume(a)) continue;
    const buf = await attachmentBuffer(a);
    if (!buf) continue;
    try {
      const out = await extractText(buf, mimeFor(a));
      if (out.text.trim().length >= 50) {
        resumeText = out.text;
        // Keep the original file so recruiters can download it as sent.
        resumeStorageKey = await storeResumeFile(org.id, buf, a.filename ?? "resume", mimeFor(a));
        break;
      }
    } catch { /* try next attachment */ }
  }
  if (!resumeText && bodyText.trim().length >= 50) resumeText = bodyText.trim();

  // Job intake: either the explicit <handle>+jobs@… sub-address, or — for the
  // common case where everyone uses one address — an email AI-classified as a
  // job posting rather than a candidate résumé. Parse it into a draft job and
  // stop. (Classifier defaults to "candidate" on any doubt, so résumés are safe.)
  const jobBody = `${subject}\n\n${resumeText || bodyText}`.trim();
  const routeToJob = isJobIntake(toList) || (await classifyIntakeEmail(subject, resumeText || bodyText)) === "job";
  if (routeToJob) {
    if (jobBody.length < 30) return NextResponse.json({ ok: true, ignored: "empty-job-email" });
    try {
      const parsed = await parseJobFromText(jobBody, { orgId: org.id, userId: "email-intake" });
      const newJobId = await createDraftJobFromParsed(org.id, parsed, "email-intake");
      return NextResponse.json({ ok: true, draft_job: !!newJobId, job_id: newJobId, title: parsed.title ?? null });
    } catch {
      return NextResponse.json({ ok: true, draft_job: false, error: "job-parse-failed" });
    }
  }

  // Structured extraction — run the same résumé parser the upload path uses, so
  // emailed candidates get a real name, email, and phone (not just the sender
  // handle). Skipped for short body-only mail; never blocks on parser failure.
  let parsedName: string | null = null;
  let parsedEmail: string | null = null;
  let parsedPhone: string | null = null;
  let parsedSkills: string[] = [];
  if (resumeText.trim().length >= 50) {
    try {
      const parsed = await parseResumeText(resumeText);
      parsedName = parsed.name?.trim() || null;
      parsedEmail = parsed.email?.trim().toLowerCase() || null;
      parsedPhone = parsed.phone?.trim() || null;
      parsedSkills = Array.isArray(parsed.skills) ? parsed.skills.map((s) => String(s).trim()).filter(Boolean) : [];
    } catch { /* fall back to sender/regex below */ }
  }

  // Candidate identity: a forwarded email's From is the recruiter, so the résumé
  // is the most reliable source — prefer the parsed name/email, then the body,
  // then the actual sender.
  const candidateEmail = parsedEmail ?? firstEmail(resumeText) ?? firstEmail(bodyText) ?? sender.email;
  const candidateName = parsedName ?? sender.name ?? candidateEmail.split("@")[0];

  const jobId = await getOrCreateIntakePool(org.id, "intake@email");
  if (!jobId) return NextResponse.json({ ok: true, error: "no-pool" });

  const { id, deduped } = await createIntakeApplication({
    orgId: org.id, jobId, name: candidateName, email: candidateEmail, phone: parsedPhone,
    resumeText: resumeText || null, resumeStorageKey, skills: parsedSkills,
    coverLetter: subject ? `Subject: ${subject}` : null, source: "email",
  });

  return NextResponse.json({
    ok: true,
    application_id: id,
    deduped,
    resume: !!resumeText,
    ...(couldNotFetchFull
      ? { warning: process.env.RESEND_API_KEY ? "could-not-fetch-full-email" : "RESEND_API_KEY-not-set-resume-skipped" }
      : {}),
  });
}
