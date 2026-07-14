import { supabaseAdmin } from "@/lib/supabase";

const CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
export const MICROSOFT_REDIRECT = `${APP_URL}/api/enterprise/microsoft/callback`;

const SCOPES = [
  "https://graph.microsoft.com/Calendars.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
  "https://graph.microsoft.com/User.Read",
  "offline_access",
  "openid",
  "email",
];

export function microsoftConfigured(): boolean {
  return !!CLIENT_ID && !!CLIENT_SECRET;
}

export function microsoftAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID ?? "",
    redirect_uri: MICROSOFT_REDIRECT,
    response_type: "code",
    scope: SCOPES.join(" "),
    response_mode: "query",
    state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${p}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
}

export async function exchangeMicrosoftCode(code: string): Promise<TokenResponse> {
  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID ?? "",
      client_secret: CLIENT_SECRET ?? "",
      redirect_uri: MICROSOFT_REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Microsoft token exchange failed: ${err}`);
  }
  return res.json();
}

export async function getValidMicrosoftToken(userId: string): Promise<string | null> {
  const { data: acct } = await supabaseAdmin
    .from("enterprise_oauth_accounts")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "microsoft")
    .maybeSingle();
  if (!acct?.refresh_token) return null;

  const stillValid =
    acct.access_token &&
    acct.expires_at &&
    new Date(acct.expires_at as string).getTime() - 60_000 > Date.now();
  if (stillValid) return acct.access_token as string;

  const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID ?? "",
      client_secret: CLIENT_SECRET ?? "",
      refresh_token: acct.refresh_token as string,
      grant_type: "refresh_token",
      scope: SCOPES.join(" "),
    }),
  });
  if (!res.ok) return null;
  const t = (await res.json()) as TokenResponse;
  const expires_at = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();
  await supabaseAdmin
    .from("enterprise_oauth_accounts")
    .update({ access_token: t.access_token, expires_at })
    .eq("user_id", userId)
    .eq("provider", "microsoft");
  return t.access_token;
}

export async function getMicrosoftProfile(accessToken: string): Promise<{ email: string; name: string } | null> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,displayName,userPrincipalName", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { mail?: string; displayName?: string; userPrincipalName?: string };
  return { email: (j.mail ?? j.userPrincipalName ?? ""), name: j.displayName ?? "" };
}

// Send an HTML email from the user's connected Outlook/365 mailbox via Graph.
// Mirrors sendFromRecruiterGmail — the campaign cron uses it so replies thread
// back into the recruiter's own inbox.
export async function sendFromMicrosoft(
  userId: string,
  opts: { to: string; subject: string; html: string; replyTo?: string | null },
): Promise<{ ok: boolean; error?: string }> {
  const token = await getValidMicrosoftToken(userId);
  if (!token) return { ok: false, error: "Outlook not connected." };
  const message: Record<string, unknown> = {
    subject: opts.subject,
    body: { contentType: "HTML", content: opts.html },
    toRecipients: [{ emailAddress: { address: opts.to } }],
  };
  if (opts.replyTo) message.replyTo = [{ emailAddress: { address: opts.replyTo } }];
  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message, saveToSentItems: true }),
  });
  if (!res.ok) return { ok: false, error: `Outlook send failed: ${res.status}` };
  return { ok: true };
}

export interface OutlookCalendarEventInput {
  subject: string;
  body?: string;
  location?: string | null;
  startISO: string;
  endISO: string;
  timeZone?: string;
  attendees?: { email: string; name?: string }[];
}

export async function createOutlookCalendarEvent(
  userId: string,
  ev: OutlookCalendarEventInput
): Promise<{ ok: boolean; webLink?: string; error?: string }> {
  const token = await getValidMicrosoftToken(userId);
  if (!token) return { ok: false, error: "Microsoft account not connected." };

  const tz = ev.timeZone ?? "UTC";
  const payload: Record<string, unknown> = {
    subject: ev.subject,
    body: { contentType: "text", content: ev.body ?? "" },
    start: { dateTime: ev.startISO, timeZone: tz },
    end: { dateTime: ev.endISO, timeZone: tz },
    isOnlineMeeting: false,
  };
  if (ev.location) payload.location = { displayName: ev.location };
  if (ev.attendees?.length) {
    payload.attendees = ev.attendees.map((a) => ({
      emailAddress: { address: a.email, name: a.name ?? a.email },
      type: "required",
    }));
  }

  const res = await fetch("https://graph.microsoft.com/v1.0/me/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return { ok: false, error: `Graph API error: ${res.status}` };
  const j = (await res.json()) as { webLink?: string };
  return { ok: true, webLink: j.webLink };
}

export async function sendOutlookEmail(
  userId: string,
  opts: { to: string; subject: string; html: string; saveToSentItems?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  const token = await getValidMicrosoftToken(userId);
  if (!token) return { ok: false, error: "Microsoft account not connected." };

  const res = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        subject: opts.subject,
        body: { contentType: "html", content: opts.html },
        toRecipients: [{ emailAddress: { address: opts.to } }],
      },
      saveToSentItems: opts.saveToSentItems ?? true,
    }),
  });
  if (!res.ok) return { ok: false, error: `Graph API send error: ${res.status}` };
  return { ok: true };
}
