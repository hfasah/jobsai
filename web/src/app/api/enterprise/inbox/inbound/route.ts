import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { extractText } from "@/lib/resume-extractor";
import {
  resolveIntakeOrg, getOrCreateIntakePool, createIntakeApplication, parseAddress, firstEmail,
} from "@/lib/enterprise-intake-inbox";

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
  if (!key) return null;
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
  const toList = ([] as string[])
    .concat((data.to as string[] | string) ?? [])
    .concat((data.cc as string[] | string) ?? [])
    .flat()
    .map(String);

  const org = await resolveIntakeOrg(toList);
  if (!org) return NextResponse.json({ ok: true, ignored: "no-intake-match" });

  const full = emailId ? await fetchReceivedEmail(emailId) : null;
  const fromRaw = (full?.from as string) ?? (data.from as string);
  const sender = parseAddress(fromRaw);
  const subject = full?.subject ?? (data.subject as string) ?? "";
  const bodyText = full?.text ?? (full?.html ? full.html.replace(/<[^>]+>/g, " ") : "") ?? "";

  // Resume text: from the first resume attachment, else the email body itself.
  let resumeText = "";
  const attachments = full?.attachments ?? [];
  for (const a of attachments) {
    if (!isResume(a)) continue;
    const buf = await attachmentBuffer(a);
    if (!buf) continue;
    try {
      const out = await extractText(buf, mimeFor(a));
      if (out.text.trim().length >= 50) { resumeText = out.text; break; }
    } catch { /* try next attachment */ }
  }
  if (!resumeText && bodyText.trim().length >= 50) resumeText = bodyText.trim();

  // Candidate identity: a forwarded email's From is the recruiter, so prefer an
  // address found in the body/resume; fall back to the actual sender.
  const candidateEmail = firstEmail(resumeText) ?? firstEmail(bodyText) ?? sender.email;
  const candidateName = sender.name ?? candidateEmail.split("@")[0];

  const jobId = await getOrCreateIntakePool(org.id, "intake@email");
  if (!jobId) return NextResponse.json({ ok: true, error: "no-pool" });

  const { id, deduped } = await createIntakeApplication({
    orgId: org.id, jobId, name: candidateName, email: candidateEmail,
    resumeText: resumeText || null, coverLetter: subject ? `Subject: ${subject}` : null, source: "email",
  });

  return NextResponse.json({ ok: true, application_id: id, deduped });
}
