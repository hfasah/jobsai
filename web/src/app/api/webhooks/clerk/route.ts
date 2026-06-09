import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { verifySvix } from "@/lib/svix";
import { sendWelcomeEmail } from "@/lib/email";

// Throwaway / disposable email domains — users signing up with these get no
// welcome email and no credit grant. Add more as new services appear.
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com","10minutemail.net","10minutemail.org","10minutemail.de",
  "guerrillamail.com","guerrillamail.net","guerrillamail.org","guerrillamail.de",
  "guerrillamail.info","guerrillamail.biz","guerrillamailblock.com",
  "mailinator.com","mailinator.net","mailinator.org",
  "sharklasers.com","guerrillamailblock.com","grr.la","guerrillamailblock.com",
  "spam4.me","trashmail.com","trashmail.net","trashmail.org","trashmail.at",
  "trashmail.me","trashmail.io","trashmail.de",
  "yopmail.com","yopmail.fr","cool.fr.nf","jetable.fr.nf","nospam.ze.tc",
  "nomail.xl.cx","mega.zik.dj","speed.1s.fr","courriel.fr.nf","moncourrier.fr.nf",
  "monemail.fr.nf","monmail.fr.nf",
  "tempmail.com","tempmail.net","tempmail.org","temp-mail.org","temp-mail.io",
  "tempr.email","discard.email","fakeinbox.com","mailnull.com","spamgourmet.com",
  "spamgourmet.net","spamgourmet.org","spamgourmet.com",
  "throwam.com","throwaway.email","mailnesia.com","maildrop.cc",
  "dispostable.com","mailnull.com","spamevader.com",
  "getairmail.com","filzmail.com","throwam.com",
  "anonaddy.com","simplelogin.io",
]);

function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;
  // Exact match or any subdomain of a known throwaway domain.
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  const parts = domain.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    if (DISPOSABLE_DOMAINS.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

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

  // Silently skip disposable/throwaway addresses — no welcome email, no credits.
  // The account still exists in Clerk; we just don't reward it.
  if (isDisposableEmail(to)) {
    console.warn("[webhooks/clerk] disposable email blocked:", to.split("@")[1]);
    return NextResponse.json({ ok: true, ignored: "disposable-email" });
  }

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
