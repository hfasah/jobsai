import { NextRequest, NextResponse } from "next/server";
import { resend, FROM_SUPPORT } from "@/lib/resend";
import { verifyPartnerApplication } from "@/lib/partner-program";

// Confirm the emailed code → activate the partner and return their referral link.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const email = String(b.email ?? "").trim();
  const code = String(b.code ?? "").trim();
  if (!email || !code) return NextResponse.json({ error: "Email and code are required." }, { status: 400 });

  const result = await verifyPartnerApplication(email, code);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const origin = req.nextUrl.origin;
  const link = `${origin}/partner/${result.partner.referral_code}`;
  const portalLink = result.partner.portal_token
    ? `${origin}/enterprise/partners/portal/${result.partner.portal_token}`
    : null;

  if (result.partner.email) {
    try {
      await resend.emails.send({
        from: FROM_SUPPORT,
        to: result.partner.email,
        subject: "You're a JobsAI Partner — your referral link is ready 🎉",
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto">
            <h2 style="color:#6d28d9">Welcome to the JobsAI Partner Program!</h2>
            <p>You'll earn <strong>${result.partner.commission_rate}% recurring commission</strong> on every customer you refer. Share your link:</p>
            <p style="background:#f5f3ff;padding:14px;border-radius:8px;word-break:break-all"><a href="${link}">${link}</a></p>
            ${portalLink ? `<p>Track your referrals & earnings in your private dashboard:</p><p style="background:#f5f3ff;padding:14px;border-radius:8px;word-break:break-all"><a href="${portalLink}">${portalLink}</a></p>` : ""}
            <p style="color:#888;font-size:13px;margin-top:20px">Tip: add <strong>support@send.jobsai.work</strong> to your contacts so our emails don't land in spam.</p>
          </div>
        `,
      });
    } catch {
      // Best-effort — the links are also shown on screen.
    }
  }

  return NextResponse.json({
    data: {
      referral_code: result.partner.referral_code,
      link,
      portal_link: portalLink,
      commission_rate: result.partner.commission_rate,
      is_founding: result.partner.is_founding,
    },
  });
}
