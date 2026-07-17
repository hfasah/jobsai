// Standing booking links: availability math + link management + the booking
// action itself. A candidate opens /enterprise/book/p/<token> (or the AI SDR
// books on their behalf mid-conversation), sees open slots (work hours minus
// Google Calendar busy minus existing bookings), and books one. SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";
import { listBusyIntervals, createEnterpriseCalendarEvent } from "@/lib/google-calendar-enterprise";
import { getRecruiterIdentity } from "@/lib/sourcing-email";

export interface BookingLink {
  id: string;
  org_id: string;
  user_id: string;
  token: string;
  title: string;
  duration_min: number;
  buffer_min: number;
  window_days: number;
  work_start: number;
  work_end: number;
  timezone: string;
  business_days_only: boolean;
  create_on_calendar_id: string;
  conflict_calendar_ids: string[];
  active: boolean;
}

const LINK_COLS =
  "id, org_id, user_id, token, title, duration_min, buffer_min, window_days, work_start, work_end, timezone, business_days_only, create_on_calendar_id, conflict_calendar_ids, active";

export async function getOrCreateBookingLink(orgId: string, userId: string): Promise<BookingLink | null> {
  const { data: existing } = await supabaseAdmin
    .from("enterprise_booking_links")
    .select(LINK_COLS)
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing as unknown as BookingLink;
  const { data: created } = await supabaseAdmin
    .from("enterprise_booking_links")
    .insert({ org_id: orgId, user_id: userId })
    .select(LINK_COLS)
    .single();
  return (created as unknown as BookingLink) ?? null;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work";

// Full public URL of a recruiter's booking page (created on first use). Used
// by the {{booking_link}} template variable and the AI SDR's scheduling offer.
export async function bookingUrlFor(orgId: string, userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;
  const link = await getOrCreateBookingLink(orgId, userId);
  return link && link.active ? `${BASE_URL}/enterprise/book/p/${link.token}` : null;
}

export async function getBookingLinkByToken(token: string): Promise<BookingLink | null> {
  const { data } = await supabaseAdmin
    .from("enterprise_booking_links")
    .select(LINK_COLS)
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();
  return (data as unknown as BookingLink) ?? null;
}

function localParts(d: Date, tz: string): { weekday: number; minuteOfDay: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "short", hour: "numeric", minute: "numeric", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const hour = parseInt(get("hour"), 10) % 24;
  const minute = parseInt(get("minute"), 10) || 0;
  return { weekday, minuteOfDay: hour * 60 + minute };
}

export interface BusyInterval { start: number; end: number }

// Open slot starts (ISO) on a 30-minute grid: inside the link's local work
// hours, at least 2h from now, the full duration fitting before work_end, and
// clear of every busy interval (padded by buffer_min).
export function computeSlots(link: BookingLink, busy: BusyInterval[], now: Date, max = 160): string[] {
  const out: string[] = [];
  const stepMs = 30 * 60_000;
  const durMs = link.duration_min * 60_000;
  const lead = now.getTime() + 2 * 3_600_000;
  const windowEnd = now.getTime() + link.window_days * 86_400_000;
  const padMs = link.buffer_min * 60_000;
  const padded = busy.map((b) => ({ start: b.start - padMs, end: b.end + padMs }));

  for (let t = Math.ceil(now.getTime() / stepMs) * stepMs; t < windowEnd && out.length < max; t += stepMs) {
    if (t < lead) continue;
    const lp = localParts(new Date(t), link.timezone);
    if (link.business_days_only && (lp.weekday === 0 || lp.weekday === 6)) continue;
    if (lp.minuteOfDay < link.work_start * 60) continue;
    if (lp.minuteOfDay + link.duration_min > link.work_end * 60) continue;
    const tEnd = t + durMs;
    if (padded.some((b) => t < b.end && tEnd > b.start)) continue;
    out.push(new Date(t).toISOString());
  }
  return out;
}

export function urlForBookingLink(link: BookingLink): string {
  return `${BASE_URL}/enterprise/book/p/${link.token}`;
}

// Live open slots for a link: work hours − Google Calendar busy − existing
// bookings. calendarChecked=false means the owner has no valid Google token
// (slots are still offered from work hours + recorded bookings).
export async function openSlotsForLink(
  link: BookingLink,
  now: Date = new Date(),
): Promise<{ slots: string[]; calendarChecked: boolean }> {
  const windowEndISO = new Date(now.getTime() + link.window_days * 86_400_000).toISOString();
  const [gcalBusy, booked] = await Promise.all([
    listBusyIntervals(link.user_id, link.conflict_calendar_ids, now.toISOString(), windowEndISO),
    bookedIntervals(link.org_id, link.user_id, now.toISOString()),
  ]);
  return {
    slots: computeSlots(link, [...(gcalBusy ?? []), ...booked], now),
    calendarChecked: gcalBusy !== null,
  };
}

// Book a slot: re-validate against LIVE availability, record the booking, and
// create the calendar event (chosen calendar, Google Meet, invite emailed to
// the candidate). Used by the public booking page AND the AI SDR's
// conversational booking. A calendar failure doesn't void the booking.
export async function bookSlot(
  link: BookingLink,
  startsAt: string,
  candidate: { name: string; email: string; phone?: string | null; notes?: string | null },
): Promise<{ ok: boolean; taken?: boolean; meetLink?: string | null; calendarOk?: boolean; error?: string }> {
  const { slots } = await openSlotsForLink(link);
  // Compare instants, not strings: the requested time may arrive in a different
  // ISO spelling than computeSlots emits (Postgres timestamptz round-trips as
  // "+00:00" while toISOString() gives ".000Z") — exact-string matching made
  // every valid slot read as taken.
  const startMs = Date.parse(startsAt);
  const canonical = slots.find((s) => Date.parse(s) === startMs);
  if (!canonical) return { ok: false, taken: true, error: "That time is no longer available." };
  startsAt = canonical;

  const endsAt = new Date(Date.parse(startsAt) + link.duration_min * 60_000).toISOString();
  const { data: row, error } = await supabaseAdmin
    .from("recruiter_availability")
    .insert({
      org_id: link.org_id,
      created_by: link.user_id,
      starts_at: startsAt,
      ends_at: endsAt,
      duration_min: link.duration_min,
      booked: true,
      booked_by_name: candidate.name,
      booked_by_email: candidate.email,
      booked_by_phone: candidate.phone ?? null,
      booked_notes: candidate.notes ?? null,
      booked_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !row) return { ok: false, error: "Could not save the booking." };

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs").select("name").eq("id", link.org_id).maybeSingle();
  const orgName = (org as { name?: string } | null)?.name ?? "Recruiting";
  const recruiter = await getRecruiterIdentity(link.user_id);

  const ev = await createEnterpriseCalendarEvent(link.user_id, {
    summary: `${link.title}: ${candidate.name} <> ${orgName}`,
    description: [
      `Booked via your JobsAI booking page.`,
      ``,
      `Candidate: ${candidate.name} <${candidate.email}>${candidate.phone ? ` · ${candidate.phone}` : ""}`,
      candidate.notes ? `Notes: ${candidate.notes}` : null,
    ].filter((x) => x !== null).join("\n"),
    startISO: startsAt,
    endISO: endsAt,
    timeZone: link.timezone,
    attendees: [{ email: candidate.email, name: candidate.name }, ...(recruiter.email ? [{ email: recruiter.email, name: recruiter.name }] : [])],
    calendarId: link.create_on_calendar_id,
    sendUpdates: "all",
    withMeet: true,
  });

  return { ok: true, meetLink: ev.meetLink ?? null, calendarOk: ev.ok };
}

// Existing bookings for the link owner (they block re-booking even if the
// calendar event hasn't landed yet, e.g. when Google was disconnected).
export async function bookedIntervals(orgId: string, userId: string, fromISO: string): Promise<BusyInterval[]> {
  const { data } = await supabaseAdmin
    .from("recruiter_availability")
    .select("starts_at, ends_at, duration_min")
    .eq("org_id", orgId)
    .eq("created_by", userId)
    .eq("booked", true)
    .gte("starts_at", fromISO);
  return ((data ?? []) as { starts_at: string; ends_at: string | null; duration_min: number }[]).map((r) => {
    const start = Date.parse(r.starts_at);
    const end = r.ends_at ? Date.parse(r.ends_at) : start + (r.duration_min || 30) * 60_000;
    return { start, end };
  });
}
