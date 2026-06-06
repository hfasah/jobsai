import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resend, FROM_SUPPORT } from "@/lib/resend";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, name, job_titles, locations, job_type, frequency } = body as Record<string, string>;

  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("job_alert_subscribers")
    .upsert({
      email, name: name || null,
      job_titles: job_titles || null,
      locations: locations || null,
      job_type: job_type || "any",
      frequency: frequency || "weekly",
      confirmed: false,
    }, { onConflict: "email" });

  if (error) {
    console.error("job_alert_subscribers upsert error", error);
    return NextResponse.json({ error: "Failed to subscribe." }, { status: 500 });
  }

  // Welcome email
  await resend.emails.send({
    from: FROM_SUPPORT,
    to: email,
    subject: "You're subscribed to JobsAI job alerts!",
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#6d28d9">Welcome to JobsAI job alerts${name ? `, ${name}` : ""}!</h2>
        <p>You'll receive ${frequency || "weekly"} job alerts matching your preferences${job_titles ? ` for <strong>${job_titles}</strong>` : ""}.</p>
        <p>While you wait for your first alert, why not let AI apply to thousands of jobs for you automatically?</p>
        <a href="https://jobsai.work/sign-up" style="display:inline-block;background:linear-gradient(135deg,#6d28d9,#4f46e5);color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Get started free
        </a>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#888;font-size:12px">
          JobsAI &middot; You can unsubscribe at any time by replying to this email.
        </p>
      </div>
    `,
  }).catch(console.error);

  return NextResponse.json({ ok: true });
}
