import { NextRequest, NextResponse } from "next/server";
import { resend, FROM_SUPPORT } from "@/lib/resend";
import { getPartnerByEmail, ensurePortalToken } from "@/lib/partner-program";

// Magic-link request: emails a verified partner a link to their dashboard.
// Always returns ok (never reveals whether an email is a partner).
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim();
  if (!email) return NextResponse.json({ error: "Enter your email." }, { status: 400 });

  const partner = await getPartnerByEmail(email);
  if (partner && partner.verified) {
    const token = await ensurePortalToken(partner);
    const link = `${req.nextUrl.origin}/enterprise/partners/portal/${token}`;
    try {
      await resend.emails.send({
        from: FROM_SUPPORT,
        to: email,
        subject: "Your JobsAI Partner dashboard link",
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
            <h2 style="color:#6d28d9">Your partner dashboard</h2>
            <p>Open your dashboard to track referrals, earnings, and payout details:</p>
            <p style="background:#f5f3ff;padding:14px;border-radius:8px;word-break:break-all"><a href="${link}">${link}</a></p>
            <p style="color:#888;font-size:13px;margin-top:20px">If this wasn't you, you can ignore this email. Add <strong>support@send.jobsai.work</strong> to your contacts so we don't land in spam.</p>
          </div>
        `,
      });
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({ ok: true });
}
