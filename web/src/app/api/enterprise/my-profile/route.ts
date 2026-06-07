import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyMembership } from "@/lib/enterprise";

// GET — the signed-in recruiter's scheduling profile (default meeting link)
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const m = await getMyMembership(userId);
  if (!m) return NextResponse.json({ error: "No organization." }, { status: 404 });

  return NextResponse.json({ data: {
    default_meeting_link: (m as { default_meeting_link?: string }).default_meeting_link ?? "",
    calendar_provider: (m as { calendar_provider?: string }).calendar_provider ?? "zoom",
  } });
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const m = await getMyMembership(userId);
  if (!m) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { error } = await supabaseAdmin.from("enterprise_members")
    .update({ default_meeting_link: body.default_meeting_link ?? null, calendar_provider: body.calendar_provider ?? null })
    .eq("id", m.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
