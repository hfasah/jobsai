import { getValidAccessToken } from "@/lib/gmail";

export interface CalendarEventInput {
  summary: string;
  description?: string;
  location?: string | null;
  startISO: string;
  endISO: string;
  timeZone?: string | null;
}

// Create an event on the user's primary Google Calendar (no invites sent).
export async function createCalendarEvent(
  userId: string,
  ev: CalendarEventInput
): Promise<{ ok: boolean; htmlLink?: string; error?: string }> {
  const token = await getValidAccessToken(userId);
  if (!token) return { ok: false, error: "Mailbox not connected." };

  const body: Record<string, unknown> = {
    summary: ev.summary,
    description: ev.description,
    location: ev.location ?? undefined,
    start: { dateTime: ev.startISO, ...(ev.timeZone ? { timeZone: ev.timeZone } : {}) },
    end: { dateTime: ev.endISO, ...(ev.timeZone ? { timeZone: ev.timeZone } : {}) },
    reminders: { useDefault: true },
  };

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `Calendar error ${res.status}: ${t.slice(0, 200)}` };
  }
  const data = (await res.json()) as { htmlLink?: string };
  return { ok: true, htmlLink: data.htmlLink };
}
