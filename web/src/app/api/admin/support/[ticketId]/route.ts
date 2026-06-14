import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const { userId } = await auth();
  if (!userId) return null;
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return adminIds.includes(userId) ? userId : null;
}

type Msg = {
  id: string; direction: "inbound" | "outbound"; author: "customer" | "ai" | "admin";
  subject: string | null; body: string; created_at: string;
};

// GET — a ticket with its full message thread. Pre-migration tickets have no
// support_messages rows, so we synthesize the thread from the ticket's original
// message (and any single admin_reply) for a consistent view.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ ticketId: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { ticketId } = await params;

  const { data: ticket } = await supabaseAdmin
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .single();
  if (!ticket) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: rows } = await supabaseAdmin
    .from("support_messages")
    .select("id, direction, author, subject, body, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  let messages: Msg[] = (rows as Msg[] | null) ?? [];

  if (messages.length === 0) {
    // Synthesize from the legacy single-reply model.
    messages = [
      { id: "orig", direction: "inbound", author: "customer", subject: ticket.subject, body: ticket.message, created_at: ticket.created_at },
      ...(ticket.admin_reply
        ? [{ id: "reply", direction: "outbound" as const, author: "admin" as const, subject: `Re: ${ticket.subject}`, body: ticket.admin_reply, created_at: ticket.replied_at ?? ticket.created_at }]
        : []),
    ];
  }

  return NextResponse.json({ ticket, messages });
}
