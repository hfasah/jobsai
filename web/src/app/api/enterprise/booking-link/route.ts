import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import { getOrCreateBookingLink } from "@/lib/booking";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.jobsai.work";

// GET — the signed-in recruiter's standing booking link (created on first ask).
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const link = await getOrCreateBookingLink(org.id, userId);
  if (!link) return NextResponse.json({ error: "Could not create your booking link." }, { status: 500 });
  return NextResponse.json({ data: { ...link, url: `${BASE_URL}/enterprise/book/p/${link.token}` } });
}

// PATCH — update the link's settings (whitelisted fields).
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const link = await getOrCreateBookingLink(org.id, userId);
  if (!link) return NextResponse.json({ error: "Could not load your booking link." }, { status: 500 });

  const b = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof b.title === "string" && b.title.trim()) patch.title = b.title.trim().slice(0, 80);
  if (typeof b.duration_min === "number" && b.duration_min >= 10 && b.duration_min <= 120) patch.duration_min = Math.round(b.duration_min);
  if (typeof b.buffer_min === "number" && b.buffer_min >= 0 && b.buffer_min <= 60) patch.buffer_min = Math.round(b.buffer_min);
  if (typeof b.window_days === "number" && b.window_days >= 1 && b.window_days <= 60) patch.window_days = Math.round(b.window_days);
  if (typeof b.work_start === "number" && b.work_start >= 0 && b.work_start <= 23) patch.work_start = Math.round(b.work_start);
  if (typeof b.work_end === "number" && b.work_end >= 1 && b.work_end <= 24) patch.work_end = Math.round(b.work_end);
  if (typeof b.timezone === "string" && b.timezone.trim()) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: b.timezone.trim() }); patch.timezone = b.timezone.trim(); }
    catch { return NextResponse.json({ error: "Unknown timezone." }, { status: 400 }); }
  }
  if (typeof b.business_days_only === "boolean") patch.business_days_only = b.business_days_only;
  if (typeof b.active === "boolean") patch.active = b.active;
  if (typeof b.create_on_calendar_id === "string" && b.create_on_calendar_id.trim()) patch.create_on_calendar_id = b.create_on_calendar_id.trim();
  if (Array.isArray(b.conflict_calendar_ids)) {
    const ids = b.conflict_calendar_ids.filter((x: unknown): x is string => typeof x === "string" && !!x.trim()).map((x: string) => x.trim()).slice(0, 10);
    patch.conflict_calendar_ids = ids.length ? ids : ["primary"];
  }

  const { data, error } = await supabaseAdmin
    .from("enterprise_booking_links")
    .update(patch)
    .eq("id", link.id)
    .eq("org_id", org.id)
    .select("*")
    .single();
  if (error || !data) return NextResponse.json({ error: "Could not save." }, { status: 500 });
  return NextResponse.json({ data: { ...data, url: `${BASE_URL}/enterprise/book/p/${(data as { token: string }).token}` } });
}
