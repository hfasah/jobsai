import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resend } from "@/lib/resend";

export const maxDuration = 120;

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

// Runs every 15 min (Vercel cron). Sends 24h + 1h reminders to cut no-shows.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  // candidates within the next 25h that are still active
  const { data: rows } = await supabaseAdmin
    .from("enterprise_interview_schedule")
    .select("*")
    .in("status", ["scheduled", "confirmed"])
    .gte("scheduled_at", new Date(now).toISOString())
    .lte("scheduled_at", new Date(now + 25 * 3600_000).toISOString());

  let sent = 0;
  for (const r of rows ?? []) {
    const mins = (new Date(r.scheduled_at).getTime() - now) / 60_000;
    const { data: org } = await supabaseAdmin.from("enterprise_orgs").select("name").eq("id", r.org_id).maybeSingle();
    const orgName = org?.name ?? "the company";
    const link = r.meeting_link || r.location || "";
    const when = new Date(r.scheduled_at).toLocaleString("en-US", { weekday: "long", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

    const send = async (label: string) => {
      const recipients = [r.candidate_email, ...(r.interviewer_emails ?? [])];
      await resend.emails.send({
        from: `${orgName} Recruiting <support@jobsai.work>`,
        to: recipients,
        subject: `Reminder: interview ${label} — ${r.title}`,
        html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <h2 style="color:#2563eb">Interview ${label}</h2>
          <p>This is a reminder for your interview (${r.title}) at <strong>${when}</strong>.</p>
          ${link ? `<div style="margin:18px 0"><a href="${link}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Join the meeting →</a></div>` : ""}
          ${r.status !== "confirmed" ? `<p><a href="${APP_URL}/enterprise/confirm/${r.confirm_token}">Confirm you're attending</a></p>` : ""}
        </div>`,
      }).catch(() => {});
      sent++;
    };

    // 24h reminder window (23.5–24.5h out)
    if (!r.reminder_24h_sent && mins <= 24 * 60 + 30 && mins >= 24 * 60 - 30) {
      await send("tomorrow");
      await supabaseAdmin.from("enterprise_interview_schedule").update({ reminder_24h_sent: true }).eq("id", r.id);
    }
    // 1h reminder window (45–75 min out)
    else if (!r.reminder_1h_sent && mins <= 75 && mins >= 0) {
      await send("in about an hour");
      await supabaseAdmin.from("enterprise_interview_schedule").update({ reminder_1h_sent: true }).eq("id", r.id);
    }
  }

  return NextResponse.json({ ok: true, checked: rows?.length ?? 0, reminders_sent: sent });
}
