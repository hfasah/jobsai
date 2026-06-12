import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resend } from "@/lib/resend";
import { buildIcs } from "@/lib/ics";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

// GET /api/enterprise/book/[token] — public: fetch slot + job info
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const { data: slot, error } = await supabaseAdmin
    .from("recruiter_availability")
    .select("id,starts_at,ends_at,duration_min,booked,job_id,org_id,job:enterprise_jobs(id,title,location)")
    .eq("booking_token", token)
    .maybeSingle();

  if (error || !slot) return NextResponse.json({ error: "Slot not found." }, { status: 404 });
  if (slot.booked) return NextResponse.json({ error: "This slot has already been booked." }, { status: 409 });

  // Fetch org name
  const { data: org } = await supabaseAdmin
    .from("enterprise_orgs")
    .select("name")
    .eq("id", slot.org_id)
    .maybeSingle();

  return NextResponse.json({
    slot: {
      id: slot.id,
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
      duration_min: slot.duration_min,
      job: slot.job,
      org_name: org?.name ?? "Your recruiter",
    },
  });
}

// POST /api/enterprise/book/[token] — public: candidate books the slot
// body: { candidate_name, candidate_email, candidate_phone?, notes? }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const b = await req.json().catch(() => ({}));

  const name: string = (b.candidate_name ?? "").trim();
  const email: string = (b.candidate_email ?? "").trim().toLowerCase();

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  // Lock slot atomically via update-where-not-booked
  const { data: slot, error: fetchErr } = await supabaseAdmin
    .from("recruiter_availability")
    .select("*,job:enterprise_jobs(id,title,location,org:enterprise_orgs(name,logo_url))")
    .eq("booking_token", token)
    .eq("booked", false)
    .maybeSingle();

  if (fetchErr || !slot) {
    return NextResponse.json({ error: "Slot not found or already taken." }, { status: 409 });
  }

  // Mark as booked
  const { error: updateErr } = await supabaseAdmin
    .from("recruiter_availability")
    .update({
      booked: true,
      booked_by_name: name,
      booked_by_email: email,
      booked_by_phone: b.candidate_phone ?? null,
      booked_notes: b.notes ?? null,
      booked_at: new Date().toISOString(),
    })
    .eq("id", slot.id)
    .eq("booked", false);

  if (updateErr) {
    return NextResponse.json({ error: "Slot was just taken. Please refresh and try again." }, { status: 409 });
  }

  // Create interview schedule row
  const { data: interview } = await supabaseAdmin
    .from("enterprise_interview_schedule")
    .insert({
      org_id: slot.org_id,
      job_id: slot.job_id ?? null,
      candidate_name: name,
      candidate_email: email,
      title: `Interview — ${name}${slot.job ? ` for ${(slot.job as Record<string, unknown>).title}` : ""}`,
      interview_type: "video",
      scheduled_at: slot.starts_at,
      duration_min: slot.duration_min ?? 45,
      self_booked: true,
      availability_slot_id: slot.id,
    })
    .select()
    .single();

  // Build ICS
  const startsAt = new Date(slot.starts_at);
  const endsAt = new Date(startsAt.getTime() + (slot.duration_min ?? 45) * 60_000);
  const jobTitle = (slot.job as Record<string, unknown> | null)?.title as string ?? "Interview";
  const orgName = ((slot.job as Record<string, unknown> | null)?.org as Record<string, unknown> | null)?.name as string ?? "Recruiter";

  const ics = buildIcs({
    uid: `booking-${slot.id}@jobsai.work`,
    title: `${jobTitle} Interview`,
    description: `Interview with ${orgName}. Booking reference: ${slot.id}`,
    location: "",
    start: startsAt,
    durationMin: slot.duration_min ?? 45,
    organizerName: orgName,
    organizerEmail: "noreply@jobsai.work",
    attendees: [{ name, email }],
  });

  // Send confirmation to candidate
  await resend.emails.send({
    from: "JobsAI <noreply@jobsai.work>",
    to: email,
    subject: `Interview Confirmed — ${jobTitle}`,
    attachments: [{ filename: "invite.ics", content: Buffer.from(ics).toString("base64") }],
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto">
        <h2 style="color:#6d28d9">Your Interview is Confirmed!</h2>
        <p>Hi ${name},</p>
        <p>Your interview for <strong>${jobTitle}</strong> with <strong>${orgName}</strong> has been confirmed.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0">
          <tr><td style="padding:6px 0;color:#666;width:120px">Date & Time</td><td style="padding:6px 0;font-weight:600">${startsAt.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}</td></tr>
          <tr><td style="padding:6px 0;color:#666">Duration</td><td style="padding:6px 0;font-weight:600">${slot.duration_min ?? 45} minutes</td></tr>
        </table>
        <p style="color:#666;font-size:13px">A calendar invite is attached. Add it to your calendar to get a reminder.</p>
        ${b.notes ? `<p style="color:#666;font-size:13px">Your notes: ${b.notes}</p>` : ""}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
        <p style="color:#9ca3af;font-size:12px">Powered by JobsAI • <a href="${APP_URL}" style="color:#6d28d9">jobsai.work</a></p>
      </div>`,
  }).catch(() => null);

  return NextResponse.json({
    ok: true,
    interview_id: interview?.id ?? null,
    starts_at: slot.starts_at,
    duration_min: slot.duration_min,
  });
}
