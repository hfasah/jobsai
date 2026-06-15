// Branded HTML emails for the Partner Program. Table-based for email-client
// compatibility, with logo header, brand accents, and a footer of links.

const SITE = "https://app.jobsai.work";
const LOGO = `${SITE}/logo.png`;
const BRAND = "#6d28d9";

export const FROM_PARTNER_TEAM = "JobsAI Enterprise Partner Team <support@send.jobsai.work>";

function brandedEmail(opts: {
  heading: string;
  intro?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const { heading, intro, bodyHtml, ctaLabel, ctaUrl } = opts;
  return `
  <div style="margin:0;padding:0;background:#0b0b12;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b12;padding:28px 12px">
      <tr><td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#13131c;border:1px solid #26263a;border-radius:16px;overflow:hidden">
          <!-- Header -->
          <tr><td style="padding:24px 28px;border-bottom:1px solid #26263a">
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td><img src="${LOGO}" width="32" height="32" alt="JobsAI" style="border-radius:8px;display:block"></td>
              <td style="padding-left:10px;color:#fff;font-weight:700;font-size:16px">JobsAI <span style="color:#a78bfa;font-weight:600;font-size:11px;letter-spacing:1px;text-transform:uppercase;border:1px solid rgba(167,139,250,.3);border-radius:999px;padding:2px 8px;margin-left:4px">Enterprise · Partners</span></td>
            </tr></table>
          </td></tr>
          <!-- Hero band -->
          <tr><td style="background:linear-gradient(135deg,rgba(109,40,217,.25),rgba(109,40,217,0));padding:32px 28px 8px">
            <h1 style="margin:0;color:#fff;font-size:24px;line-height:1.25">${heading}</h1>
            ${intro ? `<p style="margin:10px 0 0;color:#c9c9d6;font-size:15px;line-height:1.6">${intro}</p>` : ""}
          </td></tr>
          <!-- Body -->
          <tr><td style="padding:8px 28px 4px;color:#c9c9d6;font-size:15px;line-height:1.7">
            ${bodyHtml}
          </td></tr>
          ${ctaLabel && ctaUrl ? `
          <tr><td style="padding:20px 28px 28px">
            <a href="${ctaUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:12px">${ctaLabel}</a>
            <p style="margin:12px 0 0;color:#7a7a8c;font-size:12px;word-break:break-all">Or paste this link: ${ctaUrl}</p>
          </td></tr>` : ""}
          <!-- Footer -->
          <tr><td style="padding:22px 28px;border-top:1px solid #26263a;background:#0f0f17">
            <p style="margin:0 0 8px;color:#8a8a9c;font-size:13px">
              <a href="${SITE}/enterprise/partners" style="color:#a78bfa;text-decoration:none">Partner Program</a> &nbsp;·&nbsp;
              <a href="${SITE}/enterprise/guide" style="color:#a78bfa;text-decoration:none">Guide</a> &nbsp;·&nbsp;
              <a href="${SITE}/enterprise/contact" style="color:#a78bfa;text-decoration:none">Contact</a> &nbsp;·&nbsp;
              <a href="${SITE}/enterprise/privacy" style="color:#a78bfa;text-decoration:none">Privacy</a>
            </p>
            <p style="margin:0;color:#5f5f70;font-size:12px;line-height:1.6">
              JobsAI Enterprise Partner Team<br>
              3800 Confederation Pkwy, Mississauga, ON L5B 4M6, Canada<br>
              Tip: add <span style="color:#8a8a9c">support@send.jobsai.work</span> to your contacts so we don't land in spam.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </div>`;
}

// The exclusive, congratulatory invitation an admin sends to a chosen partner.
export function partnerInviteEmailHtml(opts: { name?: string | null; rate: number; acceptUrl: string }): string {
  const first = opts.name?.trim()?.split(" ")[0];
  return brandedEmail({
    heading: "Congratulations — you've been chosen 🎉",
    intro: `${first ? `${first}, you've` : "You've"} been personally invited to the <strong style="color:#fff">JobsAI Enterprise Partner Program</strong> — an invitation we extend to only a select few.`,
    bodyHtml: `
      <p style="margin:0 0 14px">This isn't an open sign-up. You were chosen because we believe the people you work with deserve the best in talent acquisition — and that you're exactly the kind of trusted voice to bring it to them.</p>
      <p style="margin:0 0 10px;color:#fff;font-weight:600">As a JobsAI Partner, you become an ambassador:</p>
      <ul style="margin:0 0 14px;padding-left:18px">
        <li style="margin-bottom:6px">Earn <strong style="color:#fff">${opts.rate}% recurring commission</strong> for 12 months on every company you refer.</li>
        <li style="margin-bottom:6px">The companies you refer get <strong style="color:#fff">priority onboarding &amp; support</strong> — your name opens doors.</li>
        <li style="margin-bottom:6px">A private partner dashboard, early access to new features, and a direct line to our team.</li>
      </ul>
      <p style="margin:0 0 6px">Accept your invitation to activate your personal referral link and dashboard. We're honoured to have you.</p>`,
    ctaLabel: "Accept your invitation",
    ctaUrl: opts.acceptUrl,
  });
}

// Sent once the partner accepts — their links are now live.
export function partnerWelcomeEmailHtml(opts: { name?: string | null; rate: number; referralUrl: string; dashboardUrl: string }): string {
  const first = opts.name?.trim()?.split(" ")[0];
  return brandedEmail({
    heading: "Welcome aboard, Partner 🤝",
    intro: `${first ? `${first}, you're` : "You're"} officially a JobsAI Enterprise Partner. Here are your links — start sharing today.`,
    bodyHtml: `
      <p style="margin:0 0 10px;color:#fff;font-weight:600">Your referral link</p>
      <p style="margin:0 0 16px;background:#0f0f17;border:1px solid #26263a;border-radius:8px;padding:12px;word-break:break-all"><a href="${opts.referralUrl}" style="color:#a78bfa;text-decoration:none">${opts.referralUrl}</a></p>
      <p style="margin:0 0 10px;color:#fff;font-weight:600">Your private dashboard <span style="color:#8a8a9c;font-weight:400">(no login — bookmark it)</span></p>
      <p style="margin:0 0 8px;background:#0f0f17;border:1px solid #26263a;border-radius:8px;padding:12px;word-break:break-all"><a href="${opts.dashboardUrl}" style="color:#a78bfa;text-decoration:none">${opts.dashboardUrl}</a></p>
      <p style="margin:14px 0 0">You earn <strong style="color:#fff">${opts.rate}% recurring commission</strong> on every customer who signs up within 90 days of clicking your link.</p>`,
  });
}
