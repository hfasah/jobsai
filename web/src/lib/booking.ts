// Standing booking links: availability math + link management. A candidate
// opens /enterprise/book/p/<token>, sees open slots (work hours minus Google
// Calendar busy minus existing bookings), and books one. SERVER-ONLY.
import { supabaseAdmin } from "@/lib/supabase";

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
