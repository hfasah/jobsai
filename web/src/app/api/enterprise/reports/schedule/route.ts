import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

function nextSendAt(frequency: "weekly" | "monthly", dayOfWeek: number): string {
  const now = new Date();
  if (frequency === "weekly") {
    const diff = (dayOfWeek - now.getDay() + 7) % 7 || 7;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff, 8, 0, 0).toISOString();
  }
  // monthly — same day next month
  return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate(), 8, 0, 0).toISOString();
}

// GET — list schedules
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("enterprise_report_schedules")
    .select("*")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST — create schedule
// body: { recipients: string[], frequency: "weekly"|"monthly", day_of_week: 0-6, filters?, label? }
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const recipients: string[] = (body.recipients ?? []).filter((e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
  if (!recipients.length) return NextResponse.json({ error: "At least one valid recipient required." }, { status: 400 });

  const frequency: "weekly" | "monthly" = body.frequency === "monthly" ? "monthly" : "weekly";
  const dayOfWeek: number = Number(body.day_of_week ?? 1);

  const { data, error } = await supabaseAdmin
    .from("enterprise_report_schedules")
    .insert({
      org_id: org.id,
      created_by: userId,
      label: body.label?.trim() || `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} report`,
      recipients,
      frequency,
      day_of_week: dayOfWeek,
      filters: body.filters ?? {},
      active: true,
      next_send_at: nextSendAt(frequency, dayOfWeek),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// DELETE — remove schedule
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required." }, { status: 400 });

  await supabaseAdmin.from("enterprise_report_schedules").delete().eq("id", id).eq("org_id", org.id);
  return NextResponse.json({ ok: true });
}
