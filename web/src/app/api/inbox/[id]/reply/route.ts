import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { sendReply } from "@/lib/gmail";

// POST /api/inbox/[id]/reply — reply to a message, sent through the user's Gmail.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Reply is empty." }, { status: 400 });

  const { data: msg } = await supabaseAdmin
    .from("inbox_messages")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!msg) return NextResponse.json({ error: "Message not found." }, { status: 404 });
  if (!msg.from_email) return NextResponse.json({ error: "No sender to reply to." }, { status: 400 });

  const { data: acct } = await supabaseAdmin.from("email_accounts").select("email").eq("user_id", userId).maybeSingle();
  if (!acct?.email) return NextResponse.json({ error: "Mailbox not connected." }, { status: 409 });

  const { data: profile } = await supabaseAdmin.from("apply_profiles").select("first_name, last_name").eq("user_id", userId).maybeSingle();
  const fromName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ");
  const subject = msg.subject && msg.subject.toLowerCase().startsWith("re:") ? msg.subject : `Re: ${msg.subject ?? ""}`;

  const result = await sendReply(userId, {
    fromEmail: acct.email, fromName, to: msg.from_email, subject, text,
    inReplyTo: msg.rfc_message_id ?? undefined, threadId: msg.provider_thread_id ?? undefined,
  });
  if (!result.ok) return NextResponse.json({ error: result.error ?? "Send failed." }, { status: 502 });

  await supabaseAdmin.from("inbox_messages").insert({
    user_id: userId, direction: "outbound", from_email: acct.email, from_name: fromName || null,
    to_email: msg.from_email, subject, body_text: text, classification: "other",
    provider_thread_id: msg.provider_thread_id, job_id: msg.job_id ?? null,
  });
  await supabaseAdmin.from("inbox_messages").update({ is_read: true }).eq("id", id).eq("user_id", userId);

  return NextResponse.json({ ok: true });
}
