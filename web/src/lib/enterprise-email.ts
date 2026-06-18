// Branded, email-client-safe HTML templates for JobsAI Enterprise.
// Table-based layout with inline styles (Gmail/Outlook strip <style> and most
// modern CSS). Indigo brand to match the marketing site.

const BRAND = "#4f46e5";
const BRAND_2 = "#7c3aed";
const INK = "#0f172a";
const MUTED = "#475569";
const FAINT = "#94a3b8";
const LINE = "#e2e8f0";
const SURFACE = "#f8fafc";

function esc(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Numbered step row used in "what happens next" lists.
function step(n: number, text: string): string {
  return `
    <tr>
      <td valign="top" style="padding:6px 0;width:30px;">
        <span style="display:inline-block;width:24px;height:24px;border-radius:12px;background:#eef2ff;color:${BRAND};font-size:12px;font-weight:700;text-align:center;line-height:24px;">${n}</span>
      </td>
      <td valign="top" style="padding:6px 0 6px 4px;font-size:14px;line-height:1.55;color:${MUTED};">${text}</td>
    </tr>`;
}

// Shared shell: branded header, content, footer. `replyHint` reminds the reader
// they can just reply (the route sets Reply-To to a monitored inbox).
function shell(opts: { appUrl: string; preheader: string; content: string }): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef0f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef0f4;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,0.08);">
        <tr><td style="background:linear-gradient(135deg,${BRAND},${BRAND_2});padding:26px 32px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.02em;">JobsAI <span style="opacity:.85;font-weight:600;">Enterprise</span></span>
          <p style="margin:4px 0 0;color:rgba(255,255,255,.82);font-size:13px;">The AI-Powered Talent Acquisition Operating System</p>
        </td></tr>
        <tr><td style="padding:32px;">${opts.content}</td></tr>
        <tr><td style="padding:20px 32px;background:${SURFACE};border-top:1px solid #eef0f4;">
          <p style="margin:0 0 6px;font-size:13px;color:${MUTED};">Questions? Just reply to this email — it goes straight to our team.</p>
          <p style="margin:0;font-size:12px;color:${FAINT};">JobsAI Enterprise &middot; <a href="${opts.appUrl}" style="color:#6366f1;text-decoration:none;">app.jobsai.work</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">${label} &rarr;</a>`;
}

// Acknowledgement sent to a prospect after they submit the enterprise intake form.
export function intakeAckEmail(opts: {
  firstName: string;
  company: string;
  planLabel?: string | null;
  appUrl: string;
}): { subject: string; html: string } {
  const first = esc(opts.firstName);
  const company = esc(opts.company);
  const subject = `Thanks, ${opts.firstName.split(/\s+/)[0]} — we've got your JobsAI Enterprise request`;

  const planCard = opts.planLabel
    ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 8px;border:1px solid ${LINE};border-radius:12px;background:${SURFACE};">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6366f1;">Recommended plan</p>
          <p style="margin:0;font-size:18px;font-weight:700;color:${INK};">${esc(opts.planLabel)}</p>
          <p style="margin:6px 0 0;font-size:13px;line-height:1.5;color:#64748b;">Based on the tools and team size you selected. Nothing is locked in — we'll confirm the best fit with you.</p>
        </td></tr>
      </table>`
    : "";

  const content = `
    <div style="display:inline-block;background:#ecfdf5;border-radius:999px;padding:6px 12px;font-size:13px;font-weight:600;color:#059669;margin-bottom:16px;">&#10003; Request received</div>
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${INK};line-height:1.3;">Thanks, ${first} — we've got your request</h1>
    <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:${MUTED};">Thanks for sharing what <strong style="color:${INK};">${company}</strong> needs. Our team is reviewing your requirements and will follow up shortly to set up a workspace tailored to how you hire.</p>
    ${planCard}
    <p style="margin:22px 0 10px;font-size:14px;font-weight:700;color:${INK};">What happens next</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${step(1, "A specialist reviews your requirements and the tools you use today.")}
      ${step(2, "We reach out to schedule a tailored walkthrough — usually within one business day.")}
      ${step(3, "Your workspace is configured to your roles and pipeline, ready to go live.")}
    </table>
    <p style="margin:24px 0 0;">${button(`${opts.appUrl}/enterprise/demo`, "Book a live demo")}
      <a href="${opts.appUrl}/enterprise/built-for" style="display:inline-block;margin-left:6px;padding:12px 10px;color:${BRAND};text-decoration:none;font-size:14px;font-weight:600;">See what's included</a>
    </p>
    <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:${MUTED};">Talk soon,<br/><strong style="color:${INK};">The JobsAI Enterprise team</strong></p>`;

  return {
    subject,
    html: shell({ appUrl: opts.appUrl, preheader: `We're reviewing your request for ${opts.company} and will follow up shortly.`, content }),
  };
}
