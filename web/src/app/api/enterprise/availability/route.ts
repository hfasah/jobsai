import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";
import crypto from "crypto";

// GET  — list availability slots
// POST — create availability slot(s)
// DELETE — remove a slot

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const url = new URL(req.url);
  const jobId = url.searchParams.get("jobId");

  let q = supabaseAdmin
    .from("recruiter_availability")
    .select("*")
    .eq("org_id", org.id)
    .eq("booked", false)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at");

  if (jobId) q = q.eq("job_id", jobId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const b = await req.json().catch(() => ({}));

  // Accept a batch of slots: { slots: [{ starts_at, ends_at, job_id?, duration_min? }] }
  const slots: { starts_at: string; ends_at?: string; job_id?: string; duration_min?: number }[] =
    Array.isArray(b.slots) ? b.slots : b.starts_at ? [b] : [];

  if (!slots.length) return NextResponse.json({ error: "No slots provided." }, { status: 400 });

  const rows = slots.map((s) => ({
    org_id: org.id,
    created_by: userId,
    job_id: s.job_id ?? null,
    starts_at: s.starts_at,
    ends_at: s.ends_at ?? null,
    duration_min: s.duration_min ?? 45,
    booked: false,
    booking_token: crypto.randomUUID(),
  }));

  const { data, error } = await supabaseAdmin.from("recruiter_availability").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "Slot id required." }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("recruiter_availability")
    .delete()
    .eq("id", id)
    .eq("org_id", org.id)
    .eq("booked", false);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
