// Minimal, dependency-free iCalendar (.ics) generator for interview invites.

interface IcsEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;          // meeting link or physical location
  start: Date;
  durationMin: number;
  organizerName?: string;
  organizerEmail?: string;
  attendees?: { name?: string; email: string }[];
  url?: string;               // meeting link
  status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
  method?: "REQUEST" | "CANCEL";
}

function fmt(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}
function esc(s: string): string {
  return (s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildIcs(e: IcsEvent): string {
  const end = new Date(e.start.getTime() + e.durationMin * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//JobsAI//Enterprise Interviews//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${e.method ?? "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(e.start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${esc(e.title)}`,
    e.description ? `DESCRIPTION:${esc(e.description)}` : "",
    e.location ? `LOCATION:${esc(e.location)}` : "",
    e.url ? `URL:${esc(e.url)}` : "",
    e.organizerEmail ? `ORGANIZER;CN=${esc(e.organizerName ?? "Recruiter")}:mailto:${e.organizerEmail}` : "",
    ...(e.attendees ?? []).map((a) => `ATTENDEE;CN=${esc(a.name ?? a.email)};RSVP=TRUE:mailto:${a.email}`),
    `STATUS:${e.status ?? "CONFIRMED"}`,
    "SEQUENCE:0",
    // 1-day and 1-hour reminders inside the calendar event itself
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Interview tomorrow",
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Interview in 1 hour",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}
