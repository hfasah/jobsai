import { supabaseAdmin } from "@/lib/supabase";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const GOOGLE_ENTERPRISE_REDIRECT = `${APP_URL}/api/enterprise/google/callback`;

// Calendar-only scope — no Gmail access needed on the recruiter side
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
];

export function googleEnterpriseConfigured(): boolean {
  return !!CLIENT_ID && !!CLIENT_SECRET;
}

export function googleEnterpriseAuthUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: CLIENT_ID ?? "",
    redirect_uri: GOOGLE_ENTERPRISE_REDIRECT,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
}

export async function exchangeGoogleEnterpriseCode(code: string): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID ?? "",
      client_secret: CLIENT_SECRET ?? "",
      redirect_uri: GOOGLE_ENTERPRISE_REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  return res.json();
}

export async function getGoogleEnterpriseProfileEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo?fields=email,name", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { email?: string; name?: string };
  return j.email ?? null;
}

export async function getValidGoogleEnterpriseToken(userId: string): Promise<string | null> {
  const { data: acct } = await supabaseAdmin
    .from("enterprise_oauth_accounts")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (!acct?.refresh_token) return null;

  const stillValid =
    acct.access_token &&
    acct.expires_at &&
    new Date(acct.expires_at as string).getTime() - 60_000 > Date.now();
  if (stillValid) return acct.access_token as string;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID ?? "",
      client_secret: CLIENT_SECRET ?? "",
      refresh_token: acct.refresh_token as string,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const t = (await res.json()) as TokenResponse;
  const expires_at = new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString();
  await supabaseAdmin
    .from("enterprise_oauth_accounts")
    .update({ access_token: t.access_token, expires_at })
    .eq("user_id", userId)
    .eq("provider", "google");
  return t.access_token;
}

export interface GoogleCalendarEventInput {
  summary: string;
  description?: string;
  location?: string | null;
  startISO: string;
  endISO: string;
  timeZone?: string;
  attendees?: { email: string; name?: string }[];
}

export async function createEnterpriseCalendarEvent(
  userId: string,
  ev: GoogleCalendarEventInput
): Promise<{ ok: boolean; htmlLink?: string; error?: string }> {
  const token = await getValidGoogleEnterpriseToken(userId);
  if (!token) return { ok: false, error: "Google Calendar not connected." };

  const tz = ev.timeZone ?? "UTC";
  const body: Record<string, unknown> = {
    summary: ev.summary,
    description: ev.description,
    start: { dateTime: ev.startISO, timeZone: tz },
    end: { dateTime: ev.endISO, timeZone: tz },
    reminders: { useDefault: true },
  };
  if (ev.location) body.location = ev.location;
  if (ev.attendees?.length) {
    body.attendees = ev.attendees.map((a) => ({ email: a.email, displayName: a.name ?? a.email }));
  }

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) return { ok: false, error: `Calendar API error: ${res.status}` };
  const j = (await res.json()) as { htmlLink?: string };
  return { ok: true, htmlLink: j.htmlLink };
}
