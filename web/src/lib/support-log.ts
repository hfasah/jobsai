// Log a prospect-facing outbound email into the Support Inbox so the whole
// conversation is visible in the admin portal (/admin/support). Find-or-create a
// ticket per (email, category) and append an outbound message. Best-effort —
// never blocks or fails the send. Outbound log only (reply-threading is a
// separate step that needs SUPPORT_REPLY_TO configured).
import { supabaseAdmin } from "@/lib/supabase";
import { FROM_SUPPORT } from "@/lib/resend";

export async function logOutboundEmail(opts: {
  name: string;
  email: string;
  category: string;   // e.g. "lead" | "quote"
  subject: string;
  body: string;       // plain text (admin renders whitespace-pre-wrap)
  summary?: string;   // ticket preview line
}): Promise<void> {
  try {
    const email = opts.email.trim().toLowerCase();
    if (!email) return;
    const now = new Date().toISOString();

    const { data: existing } = await supabaseAdmin
      .from("support_tickets")
      .select("id")
      .eq("email", email)
      .eq("category", opts.category)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let ticketId = existing?.id as string | undefined;

    if (!ticketId) {
      const { data: created } = await supabaseAdmin
        .from("support_tickets")
        .insert({
          name: opts.name || email,
          email,
          subject: opts.subject,
          message: opts.summary ?? opts.subject,
          category: opts.category,
          status: "open",
          read_at: now,
          replied_at: now,
        })
        .select("id")
        .single();
      ticketId = created?.id as string | undefined;
    }

    if (!ticketId) return;

    await supabaseAdmin.from("support_messages").insert({
      ticket_id: ticketId,
      direction: "outbound",
      author: "admin",
      subject: opts.subject,
      body: opts.body,
      email_to: email,
      email_from: FROM_SUPPORT,
    });

    await supabaseAdmin.from("support_tickets").update({ replied_at: now, read_at: now }).eq("id", ticketId);
  } catch (e) {
    console.error("logOutboundEmail", e);
  }
}
