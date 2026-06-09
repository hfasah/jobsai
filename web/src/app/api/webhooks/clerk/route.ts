import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifySvix } from "@/lib/svix";
import { sendWelcomeEmail } from "@/lib/email";

export const maxDuration = 15;

// POST /api/webhooks/clerk — Clerk webhook. Sends the welcome email on signup.
export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!verifySvix(process.env.CLERK_WEBHOOK_SECRET, req.headers, raw)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.type !== "user.created") {
    return NextResponse.json({ ok: true, ignored: event.type ?? "unknown" });
  }

  const data = event.data ?? {};
  const userId = data.id as string | undefined;
  if (!userId) return NextResponse.json({ ok: true, ignored: "no-id" });

  // Primary email: match primary_email_address_id, else first verified, else first.
  const emails = (data.email_addresses as
    | { id: string; email_address: string }[]
    | undefined) ?? [];
  const primaryId = data.primary_email_address_id as string | undefined;
  const to =
    emails.find((e) => e.id === primaryId)?.email_address ??
    emails[0]?.email_address ??
    null;
  if (!to) return NextResponse.json({ ok: true, ignored: "no-email" });

  const firstName =
    (data.first_name as string | null) ??
    (data.username as string | null) ??
    null;

  // Idempotency: only send once per user (insert wins the race).
  const { error: claimErr } = await supabaseAdmin
    .from("welcome_emails")
    .insert({ user_id: userId, email: to });
  if (claimErr) {
    // 23505 = already sent; anything else we log but don't retry the email.
    if (claimErr.code !== "23505") console.error("[webhooks/clerk] claim failed:", claimErr);
    return NextResponse.json({ ok: true, dedup: true });
  }

  await sendWelcomeEmail({ to, firstName }).catch((e) =>
    console.error("[webhooks/clerk] welcome send failed:", e)
  );

  return NextResponse.json({ ok: true, welcomed: userId });
}
