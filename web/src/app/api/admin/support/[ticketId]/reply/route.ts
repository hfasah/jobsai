import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resend, FROM_SUPPORT, REPLY_TO_SUPPORT } from "@/lib/resend";
import { linkifyHtml } from "@/lib/email-utils";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return adminIds.includes(userId) ? userId : null;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { ticketId } = await params;
  const { reply, status } = await req.json().catch(() => ({})) as { reply: string; status?: string };

  if (!reply) return NextResponse.json({ error: "Reply text required." }, { status: 400 });

  const { data: ticket } = await supabaseAdmin
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

  // Save latest reply + update status (admin_reply kept for back-compat)
  await supabaseAdmin
    .from("support_tickets")
    .update({
      admin_reply: reply,
      status: status ?? "resolved",
      replied_at: new Date().toISOString(),
      read_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  // Append the admin reply to the thread (best-effort).
  supabaseAdmin.from("support_messages").insert({
    ticket_id: ticketId, direction: "outbound", author: "admin",
    subject: `Re: ${ticket.subject}`, body: reply,
    email_from: "support@send.jobsai.work", email_to: ticket.email,
  }).then(() => {}, (e) => console.error("support_messages admin insert", e));

  // Send reply email to user
  await resend.emails.send({
    from: FROM_SUPPORT,
    to: ticket.email,
    replyTo: REPLY_TO_SUPPORT,
    subject: `Re: ${ticket.subject} [#${ticketId.slice(0, 8)}]`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#6d28d9">Hi ${ticket.name},</h2>
        <p>We've replied to your support request:</p>
        <div style="background:#f5f3ff;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #6d28d9">
          <p style="margin:0;white-space:pre-wrap">${linkifyHtml(escapeHtml(reply))}</p>
        </div>
        <p style="color:#888;font-size:13px">Your original message:</p>
        <div style="background:#f9fafb;padding:12px;border-radius:6px;color:#666;font-size:13px">
          <p style="margin:0;white-space:pre-wrap">${escapeHtml(ticket.message)}</p>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#888;font-size:12px">JobsAI &middot; support@jobsai.work &middot; Ticket #${ticketId.slice(0, 8)}</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
