import { NextRequest, NextResponse } from "next/server";
import { resend } from "@/lib/resend";
import { acceptPartnerInvite } from "@/lib/partner-program";
import { FROM_PARTNER_TEAM, partnerWelcomeEmailHtml } from "@/lib/partner-emails";

// A partner accepts their invitation → account goes active and the live links
// are emailed.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const token = String(b.token ?? "");
  const result = await acceptPartnerInvite(token);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  const origin = req.nextUrl.origin;
  const referralUrl = `${origin}/partner/${result.partner.referral_code}`;
  const dashboardUrl = `${origin}/enterprise/partners/portal/${result.partner.portal_token}`;

  if (result.partner.email) {
    try {
      await resend.emails.send({
        from: FROM_PARTNER_TEAM,
        to: result.partner.email,
        subject: "Welcome aboard — your JobsAI Partner links are live 🤝",
        html: partnerWelcomeEmailHtml({
          name: result.partner.name,
          rate: result.partner.commission_rate,
          referralUrl,
          dashboardUrl,
        }),
      });
    } catch {
      // Links are shown on screen too.
    }
  }

  return NextResponse.json({ ok: true });
}
