import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resend, FROM_SUPPORT, SUPPORT_EMAIL } from "@/lib/resend";
import { createRateLimiter, getClientIp, tooManyRequests } from "@/lib/rate-limit";

const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 }); // 5/10 min

export async function POST(req: NextRequest) {
  const rl = limiter(getClientIp(req));
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);
  const body = await req.json().catch(() => ({}));
  const { name, email, subject, message, category } = body as Record<string, string>;

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email and message are required." }, { status: 400 });
  }

  // Save to support_tickets table
  const { data: ticket, error } = await supabaseAdmin
    .from("support_tickets")
    .insert({
      name, email,
      subject: subject || "(no subject)",
      message,
      category: category || "general",
      status: "open",
    })
    .select("id")
    .single();

  if (error) {
    console.error("support_tickets insert error", error);
    return NextResponse.json({ error: "Failed to submit ticket." }, { status: 500 });
  }

  // Notify admin
  await resend.emails.send({
    from: FROM_SUPPORT,
    to: SUPPORT_EMAIL,
    replyTo: email,
    subject: `[Support #${ticket.id.slice(0, 8)}] ${subject || message.slice(0, 60)}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#6d28d9">New support ticket</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:6px 0;color:#888;width:100px">From</td><td>${name} &lt;${email}&gt;</td></tr>
          <tr><td style="padding:6px 0;color:#888">Category</td><td>${category || "General"}</td></tr>
          <tr><td style="padding:6px 0;color:#888">Ticket ID</td><td>#${ticket.id.slice(0, 8)}</td></tr>
        </table>
        <div style="margin-top:16px;background:#f5f3ff;padding:16px;border-radius:8px">
          <p style="margin:0;white-space:pre-wrap">${message}</p>
        </div>
        <p style="margin-top:16px"><a href="https://jobsai.work/admin/support" style="color:#6d28d9">Reply in admin dashboard</a></p>
      </div>
    `,
  }).catch(console.error);

  // Auto-reply to user
  await resend.emails.send({
    from: FROM_SUPPORT,
    to: email,
    subject: `We received your message — JobsAI Support [#${ticket.id.slice(0, 8)}]`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#6d28d9">Hi ${name},</h2>
        <p>Thanks for reaching out. We've received your message and will get back to you within one business day.</p>
        <div style="background:#f5f3ff;padding:16px;border-radius:8px;margin:16px 0">
          <p style="margin:0;color:#888;font-size:13px">Your message:</p>
          <p style="margin:8px 0 0;white-space:pre-wrap">${message}</p>
        </div>
        <p style="color:#888;font-size:13px">Ticket ID: #${ticket.id.slice(0, 8)}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#888;font-size:12px">JobsAI &middot; support@jobsai.work</p>
      </div>
    `,
  }).catch(console.error);

  return NextResponse.json({ ok: true, ticketId: ticket.id });
}
