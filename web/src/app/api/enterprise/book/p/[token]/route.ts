import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getBookingLinkByToken, computeSlots, bookedIntervals } from "@/lib/booking";
import { listBusyIntervals, createEnterpriseCalendarEvent } from "@/lib/google-calendar-enterprise";
import { getRecruiterIdentity } from "@/lib/sourcing-email";

export const maxDuration = 30;
type Ctx = { params: Promise<{ token: string }> };

async function openSlots(link: NonNullable<Awaited<ReturnType<typeof getBookingLinkByToken>>>, now: Date) {
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

// GET — public: the link's details + currently-open slots. Token is the only
// credential; it exposes nothing but the org name, meeting title, and times.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const link = await getBookingLinkByToken(token);
  if (!link) return NextResponse.json({ error: "This booking link doesn't exist or was turned off." }, { status: 404 });

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs").select("name").eq("id", link.org_id).maybeSingle();
  const { slots, calendarChecked } = await openSlots(link, new Date());

  return NextResponse.json({
    data: {
      org_name: (org as { name?: string } | null)?.name ?? "Recruiting",
      title: link.title,
      duration_min: link.duration_min,
      timezone: link.timezone,
      slots,
      calendar_checked: calendarChecked,
    },
  });
}

// POST { starts_at, name, email, phone?, notes? } — public: book a slot.
// Re-validates the slot against LIVE availability, records the booking, and
// creates the calendar event (chosen calendar, Google Meet, invite emailed).
export async function POST(req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const link = await getBookingLinkByToken(token);
  if (!link) return NextResponse.json({ error: "This booking link doesn't exist or was turned off." }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const startsAt = typeof b.starts_at === "string" ? b.starts_at : "";
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 120) : "";
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const phone = typeof b.phone === "string" ? b.phone.trim().slice(0, 40) : null;
  const notes = typeof b.notes === "string" ? b.notes.trim().slice(0, 2000) : null;
  if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Your name and a valid email are required." }, { status: 400 });
  }

  // The slot must still be open RIGHT NOW (someone else may have taken it).
  const { slots } = await openSlots(link, new Date());
  if (!slots.includes(startsAt)) {
    return NextResponse.json({ error: "That time was just taken — pick another slot.", taken: true }, { status: 409 });
  }

  const endsAt = new Date(Date.parse(startsAt) + link.duration_min * 60_000).toISOString();
  const { data: bookingRow, error } = await supabaseAdmin
    .from("recruiter_availability")
    .insert({
      org_id: link.org_id,
      created_by: link.user_id,
      starts_at: startsAt,
      ends_at: endsAt,
      duration_min: link.duration_min,
      booked: true,
      booked_by_name: name,
      booked_by_email: email,
      booked_by_phone: phone,
      booked_notes: notes,
      booked_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !bookingRow) return NextResponse.json({ error: "Could not save the booking — try again." }, { status: 500 });

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs").select("name").eq("id", link.org_id).maybeSingle();
  const orgName = (org as { name?: string } | null)?.name ?? "Recruiting";
  const recruiter = await getRecruiterIdentity(link.user_id);

  // Calendar event on the chosen calendar, with a Meet link, inviting the
  // candidate (sendUpdates=all emails them the invite). A calendar failure
  // doesn't void the booking — the recruiter still sees it in-app.
  const ev = await createEnterpriseCalendarEvent(link.user_id, {
    summary: `${link.title}: ${name} <> ${orgName}`,
    description: [
      `Booked via your JobsAI booking page.`,
      ``,
      `Candidate: ${name} <${email}>${phone ? ` · ${phone}` : ""}`,
      notes ? `Notes: ${notes}` : null,
    ].filter((x) => x !== null).join("\n"),
    startISO: startsAt,
    endISO: endsAt,
    timeZone: link.timezone,
    attendees: [{ email, name }, ...(recruiter.email ? [{ email: recruiter.email, name: recruiter.name }] : [])],
    calendarId: link.create_on_calendar_id,
    sendUpdates: "all",
    withMeet: true,
  });

  return NextResponse.json({
    data: {
      ok: true,
      starts_at: startsAt,
      duration_min: link.duration_min,
      timezone: link.timezone,
      meet_link: ev.meetLink ?? null,
      calendar_ok: ev.ok,
    },
  });
}
