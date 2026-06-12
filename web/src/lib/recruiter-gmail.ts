import { getValidGoogleEnterpriseToken } from "@/lib/google-calendar-enterprise";
import { supabaseAdmin } from "@/lib/supabase";

export interface RecruiterEmailOpts {
  to: string;
  subject: string;
  html: string;
  fromName?: string;
  inReplyTo?: string;
  threadId?: string;
}

export async function sendFromRecruiterGmail(
  userId: string,
  opts: RecruiterEmailOpts
): Promise<{ ok: boolean; error?: string }> {
  const token = await getValidGoogleEnterpriseToken(userId);
  if (!token) return { ok: false, error: "Gmail not connected." };

  const { data: acct } = await supabaseAdmin
    .from("enterprise_oauth_accounts")
    .select("email")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  const fromEmail = acct?.email as string | null;
  if (!fromEmail) return { ok: false, error: "Could not determine sender email." };

  const from = opts.fromName ? `${opts.fromName} <${fromEmail}>` : fromEmail;
  const lines = [
    `From: ${from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    'Content-Type: text/html; charset="UTF-8"',
    "MIME-Version: 1.0",
  ];
  if (opts.inReplyTo) {
    lines.push(`In-Reply-To: ${opts.inReplyTo}`, `References: ${opts.inReplyTo}`);
  }
  lines.push("", opts.html);

  const raw = Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const body: Record<string, string> = { raw };
  if (opts.threadId) body.threadId = opts.threadId;

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, error: `Gmail send failed: ${res.status}` };
  return { ok: true };
}

export interface GmailThread {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export async function getCandidateEmailThread(
  userId: string,
  candidateEmail: string
): Promise<GmailThread[]> {
  const token = await getValidGoogleEnterpriseToken(userId);
  if (!token) return [];

  const q = encodeURIComponent(`from:${candidateEmail} OR to:${candidateEmail}`);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) return [];
  const list = (await listRes.json()) as { messages?: { id: string }[] };
  const ids = (list.messages ?? []).map((m) => m.id).slice(0, 10);
  if (!ids.length) return [];

  const threads: GmailThread[] = [];
  for (const id of ids) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject,From,Date`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!msgRes.ok) continue;
    const msg = (await msgRes.json()) as {
      id: string;
      snippet?: string;
      payload?: { headers?: { name: string; value: string }[] };
    };
    const h = (name: string) =>
      msg.payload?.headers?.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? "";
    threads.push({
      id: msg.id,
      subject: h("Subject"),
      from: h("From"),
      date: h("Date"),
      snippet: msg.snippet ?? "",
    });
  }
  return threads;
}
