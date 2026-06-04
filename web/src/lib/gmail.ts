import { supabaseAdmin } from "@/lib/supabase";
import { classifyEmail, type InboxClass } from "@/lib/inbox";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const GOOGLE_REDIRECT = `${APP_URL}/api/inbox/google/callback`;

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
];

export function gmailConfigured(): boolean {
  return !!CLIENT_ID && !!CLIENT_SECRET;
}

export function googleAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID ?? "",
    redirect_uri: GOOGLE_REDIRECT,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

interface TokenResponse {
  access_token: string; refresh_token?: string; expires_in: number; id_token?: string;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: CLIENT_ID ?? "", client_secret: CLIENT_SECRET ?? "",
      redirect_uri: GOOGLE_REDIRECT, grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return res.json();
}

// Returns a fresh access token, refreshing + persisting when expired.
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const { data: acct } = await supabaseAdmin
    .from("email_accounts")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!acct?.refresh_token) return null;

  const stillValid = acct.access_token && acct.expires_at && new Date(acct.expires_at).getTime() - 60_000 > Date.now();
  if (stillValid) return acct.access_token;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID ?? "", client_secret: CLIENT_SECRET ?? "",
      refresh_token: acct.refresh_token, grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const t = (await res.json()) as TokenResponse;
  const expires_at = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();
  await supabaseAdmin.from("email_accounts").update({ access_token: t.access_token, expires_at, updated_at: new Date().toISOString() }).eq("user_id", userId);
  return t.access_token;
}

export async function getProfileEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { emailAddress?: string };
  return j.emailAddress ?? null;
}

// ─── Message parsing ──────────────────────────────────────────────────────────

interface GmailPart { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] }
interface GmailMessage {
  id: string; threadId: string;
  payload?: { headers?: { name: string; value: string }[]; body?: { data?: string }; parts?: GmailPart[] };
}

function b64urlDecode(data?: string): string {
  if (!data) return "";
  try { return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); }
  catch { return ""; }
}

function extractText(part?: GmailPart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return b64urlDecode(part.body.data);
  if (part.parts) {
    for (const p of part.parts) { const t = extractText(p); if (t) return t; }
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return b64urlDecode(part.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return "";
}

function parseAddress(raw: string): { email: string; name: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: "", email: raw.trim() };
}

export interface ParsedEmail {
  id: string; threadId: string;
  from: { email: string; name: string }; to: string;
  subject: string; date: string; rfcMessageId: string; text: string;
}

async function getMessage(accessToken: string, id: string): Promise<ParsedEmail | null> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const m = (await res.json()) as GmailMessage;
  const headers = m.payload?.headers ?? [];
  const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n.toLowerCase())?.value ?? "";
  let text = extractText(m.payload as GmailPart);
  if (!text && m.payload?.body?.data) text = b64urlDecode(m.payload.body.data);
  return {
    id: m.id, threadId: m.threadId,
    from: parseAddress(h("From")),
    to: h("To"),
    subject: h("Subject"),
    date: h("Date"),
    rfcMessageId: h("Message-ID"),
    text: text.slice(0, 20000),
  };
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

// Companies in the user's JobsAI pipeline — we only ingest emails about these.
export async function getTrackedCompanies(userId: string): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from("jobs")
    .select("parsed:job_parsed(parsed_json)")
    .eq("user_id", userId)
    .limit(500);
  const set = new Set<string>();
  for (const r of data ?? []) {
    const rel = (r as { parsed?: unknown }).parsed;
    const pj = (Array.isArray(rel) ? (rel[0] as { parsed_json?: { company?: string } })?.parsed_json : (rel as { parsed_json?: { company?: string } })?.parsed_json);
    const c = String(pj?.company ?? "").toLowerCase().trim();
    if (c.length > 2) set.add(c);
  }
  return [...set];
}

export function mentionsCompany(text: string, companies: string[]): boolean {
  const t = text.toLowerCase();
  for (const c of companies) {
    if (t.includes(c)) return true;
    const token = c.split(/[\s,.]+/)[0];
    if (token.length > 3 && new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t)) return true;
  }
  return false;
}

export interface SyncInterview { id: string; subject: string; body: string; fromName: string; fromEmail: string }

export async function syncInbox(userId: string): Promise<{ imported: number; interviews: SyncInterview[] }> {
  const token = await getValidAccessToken(userId);
  if (!token) return { imported: 0, interviews: [] };

  // Only pull emails about companies the user is actually pursuing in JobsAI.
  const companies = await getTrackedCompanies(userId);
  if (!companies.length) return { imported: 0, interviews: [] };

  const orq = companies.slice(0, 25).map((c) => `"${c.replace(/"/g, "")}"`).join(" OR ");
  const q = encodeURIComponent(`(${orq}) newer_than:90d -from:me`);
  const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok) return { imported: 0, interviews: [] };
  const list = (await listRes.json()) as { messages?: { id: string }[] };
  const ids = (list.messages ?? []).map((x) => x.id);
  if (!ids.length) return { imported: 0, interviews: [] };

  // Skip ones we already have.
  const { data: existing } = await supabaseAdmin
    .from("inbox_messages")
    .select("provider_message_id")
    .eq("user_id", userId)
    .in("provider_message_id", ids);
  const have = new Set((existing ?? []).map((e) => e.provider_message_id));

  let imported = 0;
  const interviews: SyncInterview[] = [];
  for (const id of ids) {
    if (have.has(id)) continue;
    const msg = await getMessage(token, id);
    if (!msg) continue;
    // Confirm it genuinely mentions a tracked company (Gmail OR can be loose).
    if (!mentionsCompany(`${msg.from.name} ${msg.from.email} ${msg.subject} ${msg.text}`, companies)) continue;

    const classification: InboxClass = classifyEmail(msg.subject, msg.text);
    const { data: inserted, error } = await supabaseAdmin.from("inbox_messages").insert({
      user_id: userId,
      direction: "inbound",
      from_email: msg.from.email,
      from_name: msg.from.name,
      to_email: msg.to,
      subject: msg.subject,
      body_text: msg.text,
      classification,
      provider_message_id: msg.id,
      provider_thread_id: msg.threadId,
      rfc_message_id: msg.rfcMessageId,
      received_at: msg.date ? new Date(msg.date).toISOString() : new Date().toISOString(),
    }).select("id").single();
    if (!error) {
      imported++;
      if (inserted && classification === "interview") {
        interviews.push({ id: inserted.id, subject: msg.subject, body: msg.text, fromName: msg.from.name, fromEmail: msg.from.email });
      }
    }
  }

  await supabaseAdmin.from("email_accounts").update({ last_synced_at: new Date().toISOString() }).eq("user_id", userId);
  return { imported, interviews };
}

// ─── Send (reply as the user) ─────────────────────────────────────────────────

export async function sendReply(userId: string, opts: {
  fromEmail: string; fromName: string; to: string; subject: string; text: string;
  inReplyTo?: string; threadId?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const token = await getValidAccessToken(userId);
  if (!token) return { ok: false, error: "Mailbox not connected." };

  const lines = [
    `From: ${opts.fromName ? `${opts.fromName} ` : ""}<${opts.fromEmail}>`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
  ];
  if (opts.inReplyTo) { lines.push(`In-Reply-To: ${opts.inReplyTo}`, `References: ${opts.inReplyTo}`); }
  lines.push('Content-Type: text/plain; charset="UTF-8"', "", opts.text);
  const raw = Buffer.from(lines.join("\r\n")).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw, threadId: opts.threadId }),
  });
  if (!res.ok) return { ok: false, error: `Gmail send failed: ${res.status}` };
  return { ok: true };
}
