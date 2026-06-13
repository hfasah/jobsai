import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { resend, FROM_SUPPORT, SUPPORT_EMAIL } from "@/lib/resend";

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

  // Save reply + update status
  await supabaseAdmin
    .from("support_tickets")
    .update({
      admin_reply: reply,
      status: status ?? "resolved",
      replied_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  // Send reply email to user
  await resend.emails.send({
    from: FROM_SUPPORT,
    to: ticket.email,
    replyTo: SUPPORT_EMAIL,
    subject: `Re: ${ticket.subject} [#${ticketId.slice(0, 8)}]`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#6d28d9">Hi ${ticket.name},</h2>
        <p>We've replied to your support request:</p>
        <div style="background:#f5f3ff;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #6d28d9">
          <p style="margin:0;white-space:pre-wrap">${reply}</p>
        </div>
        <p style="color:#888;font-size:13px">Your original message:</p>
        <div style="background:#f9fafb;padding:12px;border-radius:6px;color:#666;font-size:13px">
          <p style="margin:0;white-space:pre-wrap">${ticket.message}</p>
        </div>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
        <p style="color:#888;font-size:12px">JobsAI &middot; support@jobsai.work &middot; Ticket #${ticketId.slice(0, 8)}</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
