import { NextRequest, NextResponse } from "next/server";
import { resend, FROM_SUPPORT } from "@/lib/resend";
import { upsertPartnerApplication } from "@/lib/partner-program";

const validEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

// Public partner application. Creates a pending, unverified partner and emails a
// 6-digit code. No login required — verification is the anti-spam gate.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim();
  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Your name is required." }, { status: 400 });
  if (!validEmail(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const { code, alreadyVerified } = await upsertPartnerApplication({
    name,
    email,
    company_name: String(b.company_name ?? "").trim() || null,
    website: String(b.website ?? "").trim() || null,
    linkedin: String(b.linkedin ?? "").trim() || null,
    audience_type: String(b.audience_type ?? "").trim() || null,
    estimated_referrals: String(b.estimated_referrals ?? "").trim() || null,
  });

  if (alreadyVerified) {
    return NextResponse.json({ alreadyVerified: true });
  }

  try {
    await resend.emails.send({
      from: FROM_SUPPORT,
      to: email,
      subject: `Your JobsAI Partner verification code: ${code}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
          <h2 style="color:#6d28d9">Verify your Partner application</h2>
          <p>Hi ${name.split(" ")[0] || "there"}, enter this code to activate your JobsAI referral link:</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:6px;background:#f5f3ff;padding:16px;border-radius:8px;text-align:center">${code}</p>
          <p style="color:#888;font-size:13px">This code expires in 15 minutes. If you didn't request it, you can ignore this email.</p>
        </div>
      `,
    });
  } catch {
    // Don't leak delivery errors; the user can request a resend.
  }

  return NextResponse.json({ ok: true, email });
}
