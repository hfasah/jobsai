import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getBookingLinkByToken, openSlotsForLink, bookSlot } from "@/lib/booking";

export const maxDuration = 30;
type Ctx = { params: Promise<{ token: string }> };

// GET — public: the link's details + currently-open slots. Token is the only
// credential; it exposes nothing but the org name, meeting title, and times.
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { token } = await params;
  const link = await getBookingLinkByToken(token);
  if (!link) return NextResponse.json({ error: "This booking link doesn't exist or was turned off." }, { status: 404 });

  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs").select("name").eq("id", link.org_id).maybeSingle();
  const { slots, calendarChecked } = await openSlotsForLink(link);

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
// Re-validates live, records the booking, creates the calendar event (chosen
// calendar, Google Meet, invite emailed to the candidate).
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

  const result = await bookSlot(link, startsAt, { name, email, phone, notes });
  if (!result.ok) {
    if (result.taken) return NextResponse.json({ error: "That time was just taken — pick another slot.", taken: true }, { status: 409 });
    return NextResponse.json({ error: result.error ?? "Could not save the booking — try again." }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      ok: true,
      starts_at: startsAt,
      duration_min: link.duration_min,
      timezone: link.timezone,
      meet_link: result.meetLink ?? null,
      calendar_ok: result.calendarOk ?? false,
    },
  });
}
