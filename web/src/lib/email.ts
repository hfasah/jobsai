import { Resend } from "resend";
import { clerkClient } from "@clerk/nextjs/server";
import { unsubUrl } from "@/lib/email-unsub";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.NOTIFICATION_FROM_EMAIL ?? "JobsAI <notifications@jobsai.work>";
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.app").replace(/\/$/, "");

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}

async function send(to: string, subject: string, html: string, headers?: Record<string, string>) {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not configured — skipping");
    return;
  }
  const { error } = await resend.emails.send({ from: FROM, to, subject, html, ...(headers ? { headers } : {}) });
  if (error) console.error("[email] Send failed:", error);
}

function wrap(body: string, unsub?: string): string {
  const unsubLink = unsub
    ? ` &nbsp;·&nbsp; <a href="${unsub}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe from job alerts</a>`
    : "";
  return wrapInner(body, unsubLink);
}

function wrapInner(body: string, unsubLink: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;padding:0 16px 40px;">
    <div style="background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
      <div style="padding:20px 28px;border-bottom:1px solid #f3f4f6;">
        <span style="font-size:15px;font-weight:700;color:#111827;letter-spacing:-0.02em;">JobsAI</span>
      </div>
      <div style="padding:28px;">${body}</div>
      <div style="padding:16px 28px;background:#f9fafb;border-top:1px solid #f3f4f6;">
        <p style="margin:0;font-size:12px;color:#9ca3af;">
          You're receiving this from your JobsAI account. &nbsp;
          <a href="${APP_URL}/dashboard/preferences" style="color:#6366f1;text-decoration:none;">Notification settings</a>${unsubLink}
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function btn(href: string, label: string, primary = true): string {
  const bg = primary ? "#4f46e5" : "#f3f4f6";
  const color = primary ? "#fff" : "#374151";
  return `<a href="${href}" style="display:inline-block;background:${bg};color:${color};text-decoration:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;margin-top:20px;">${label} →</a>`;
}

function h2(text: string): string {
  return `<h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">${text}</h2>`;
}

function p(text: string, muted = false): string {
  const color = muted ? "#6b7280" : "#374151";
  return `<p style="margin:0 0 12px;color:${color};font-size:15px;line-height:1.6;">${text}</p>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Forward an employer's reply (captured via the application alias) to the user's
// real inbox. Reply-To is the employer so the user can respond directly.
export async function sendEmployerReplyCopy(
  userId: string,
  opts: {
    jobTitle: string;
    company: string;
    fromName: string | null;
    fromEmail: string;
    subject: string;
    bodyText: string;
  }
): Promise<void> {
  const to = await getUserEmail(userId);
  if (!to || !resend) return;

  const sender = opts.fromName || opts.fromEmail;
  const quoted = escapeHtml(opts.bodyText || "").slice(0, 6000).replace(/\n/g, "<br>");
  const html = wrap(`
    ${h2(`New reply about ${escapeHtml(opts.jobTitle)}`)}
    ${p(`<strong>${escapeHtml(sender)}</strong> replied regarding your application at <strong>${escapeHtml(opts.company)}</strong>:`)}
    <div style="margin:8px 0 4px;padding:14px 16px;background:#f9fafb;border:1px solid #eef0f3;border-radius:10px;color:#374151;font-size:14px;line-height:1.6;">
      <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">Subject: ${escapeHtml(opts.subject || "(no subject)")}</p>
      ${quoted}
    </div>
    ${p(`Reply directly to this email to respond to ${escapeHtml(sender)}, or manage it in JobsAI.`, true)}
    ${btn(`${APP_URL}/dashboard/inbox`, "Open inbox")}
  `);

  const subject = /^re:/i.test(opts.subject) ? opts.subject : `Re: ${opts.subject || "Your application"}`;
  const { error } = await resend.emails.send({
    from: FROM,
    to,
    replyTo: opts.fromEmail,
    subject,
    html,
  });
  if (error) console.error("[email] reply forward failed:", error);
}

// Welcome email sent once when a member signs up.
export async function sendWelcomeEmail(opts: { to: string; firstName?: string | null }): Promise<{ ok: boolean; error?: string }> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not configured — skipping welcome email");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  const name = (opts.firstName || "").trim();
  const hi = name ? `Hi ${escapeHtml(name)},` : "Hi there,";

  const feature = (bg: string, emoji: string, title: string, desc: string) => `
    <tr>
      <td style="padding:7px 0;vertical-align:top;width:48px;">
        <div style="width:38px;height:38px;border-radius:10px;background:${bg};font-size:19px;line-height:38px;text-align:center;">${emoji}</div>
      </td>
      <td style="padding:7px 0 7px 8px;vertical-align:top;">
        <p style="margin:0;font-size:15px;font-weight:700;color:#111827;">${title}</p>
        <p style="margin:2px 0 0;font-size:13px;line-height:1.5;color:#6b7280;">${desc}</p>
      </td>
    </tr>`;

  const step = (n: number, text: string, href: string) => `
    <tr>
      <td style="padding:6px 0;vertical-align:top;width:28px;">
        <span style="display:inline-block;width:22px;height:22px;border-radius:11px;background:#eef2ff;color:#4f46e5;font-size:12px;font-weight:700;text-align:center;line-height:22px;">${n}</span>
      </td>
      <td style="padding:6px 0;vertical-align:top;font-size:14px;color:#374151;">
        <a href="${href}" style="color:#4f46e5;text-decoration:none;font-weight:600;">${text} →</a>
      </td>
    </tr>`;

  const body = `
    ${h2("Welcome to JobsAI 👋")}
    ${p(`${hi}`)}
    ${p(`I'm <strong>Hippolyte Asah</strong>, the founder of JobsAI — and I want to personally welcome you to a faster, smarter way to land your next role.`)}
    ${p(`Let's be honest — applying for jobs shouldn't feel like a full-time job. Searching boards, rewriting resumes, filling out endless forms, writing cover letters, prepping for interviews… I built JobsAI to take that off your plate.`)}
    ${p(`<strong>My mission is simple: help you spend less time applying and more time interviewing.</strong>`)}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 8px;">
      <tr><td style="background:#eef2ff;border:1px solid #e0e7ff;border-radius:12px;padding:16px 18px;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#3730a3;">Here's what starts working for you today ✨</p>
        <p style="margin:0;font-size:14px;line-height:1.95;color:#374151;">
          ✅ <strong>Finds</strong> jobs that match your skills &amp; goals<br>
          ✅ <strong>Applies</strong> for you — Auto, Hybrid, or Review<br>
          ✅ <strong>Tailors</strong> your resume to beat the ATS<br>
          ✅ <strong>Preps</strong> you for the interview
        </p>
      </td></tr>
    </table>

    <p style="margin:26px 0 6px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#6366f1;">Everything in your toolkit</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      ${feature("#eef2ff", "🔍", "AI Job Discovery", "Surfaces roles that match your skills, experience, and goals from thousands of sources.")}
      ${feature("#ecfdf5", "🚀", "Auto Apply", "Applies to matching jobs for you — choose Auto, Hybrid (approve first), or Review mode.")}
      ${feature("#eff6ff", "📄", "Resume Tailoring", "Adapts your resume to each job description to get past ATS screening.")}
      ${feature("#f0fdf4", "✅", "ATS Scanner", "Shows how well your resume matches a role and what keywords you're missing.")}
      ${feature("#fef3c7", "✍️", "AI Cover Letters", "Personalized cover letters in seconds — no blank page.")}
      ${feature("#faf5ff", "🏢", "Company Research", "Culture, likely interview questions, and hiring expectations before you apply.")}
      ${feature("#fefce8", "💰", "Salary Intelligence", "Know your market value and negotiate with confidence.")}
      ${feature("#fce7f3", "🎯", "Interview Prep", "AI interview coach, voice practice, and an avatar simulator to rehearse for real.")}
      ${feature("#ecfeff", "📊", "Progress Tracking", "Every application and interview organized in one place.")}
    </table>

    <p style="margin:28px 0 8px;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#9ca3af;">Get the most out of JobsAI — 4 quick steps</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
      ${step(1, "Upload your resume", `${APP_URL}/dashboard/resumes`)}
      ${step(2, "Complete your profile", `${APP_URL}/dashboard/apply-profile`)}
      ${step(3, "Set your target roles & preferences", `${APP_URL}/dashboard/preferences`)}
      ${step(4, "Turn on Auto Apply or Hybrid Mode", `${APP_URL}/dashboard/auto-apply`)}
    </table>
    ${p(`The more we know about your goals, the better JobsAI works for you.`, true)}

    ${btn(`${APP_URL}/dashboard/resumes`, "Upload your resume & get started")}

    <p style="margin:24px 0 0;font-size:14px;line-height:1.6;color:#374151;">
      Want a hand? Book a free <a href="${APP_URL}/dashboard/coaching" style="color:#4f46e5;text-decoration:none;font-weight:600;">JobsAI Career Strategy Session</a> for personalized guidance or a walkthrough.
    </p>

    ${p(`I'm genuinely excited to be part of your career journey. Let's get you more interviews. Let's get you hired.`)}
    ${p(`<strong style="color:#4f46e5;">Apply Less. Interview More.</strong>`)}
    <table role="presentation" cellpadding="0" cellspacing="0" align="left" style="margin:20px 0 0;">
      <tr>
        ${avatarCell(FOUNDER.name, 64, FOUNDER.photo ?? null)}
        <td style="width:16px;">&nbsp;</td>
        <td style="vertical-align:middle;">
          <p style="margin:0;font-size:16px;font-weight:700;color:#111827;">${escapeHtml(FOUNDER.name)}</p>
          <p style="margin:2px 0 0;font-size:13px;color:#6b7280;">${escapeHtml(FOUNDER.title)}</p>
        </td>
      </tr>
    </table>
    <div style="clear:both;"></div>
    ${p(`<span style="color:#9ca3af;font-size:12px;">P.S. Your next opportunity may already be waiting. Upload your resume and let JobsAI start working for you today.</span>`)}
  `;

  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: "Welcome to JobsAI — Apply Less. Interview More.",
    html: wrap(body),
  });
  if (error) {
    console.error("[email] welcome send failed:", error);
    return { ok: false, error: (error as { message?: string }).message ?? String(error) };
  }
  return { ok: true };
}

// ─── Email types ─────────────────────────────────────────────────────────────

export async function sendApplySubmitted(
  userId: string,
  jobTitle: string,
  company: string,
  jobId: string
) {
  const to = await getUserEmail(userId);
  if (!to) return;

  const html = wrap(`
    ${h2("Application submitted ✓")}
    ${p(`JobsAI just submitted your application for <strong>${jobTitle}</strong> at <strong>${company}</strong> on your behalf.`)}
    ${p("Your resume and a tailored cover letter were included. Your application tracker has been updated.", true)}
    ${btn(`${APP_URL}/dashboard/jobs/${jobId}`, "View application")}
  `);

  await send(to, `Applied: ${jobTitle} at ${company}`, html);
}

export async function sendManualRequired(
  userId: string,
  jobTitle: string,
  company: string,
  jobId: string,
  sourceUrl: string | null
) {
  const to = await getUserEmail(userId);
  if (!to) return;

  const actionUrl = sourceUrl ?? `${APP_URL}/dashboard/jobs/${jobId}`;

  const html = wrap(`
    ${h2("Action needed: submit your application")}
    ${p(`Your application for <strong>${jobTitle}</strong> at <strong>${company}</strong> requires manual submission.`)}
    ${p("JobsAI has already written a tailored cover letter for you. Open the job page, paste it in, and submit.", true)}
    <div style="display:flex;gap:12px;flex-wrap:wrap;">
      ${btn(actionUrl, "Submit application")}
      ${btn(`${APP_URL}/dashboard/jobs/${jobId}`, "View cover letter", false)}
    </div>
  `);

  await send(to, `Action needed: ${jobTitle} at ${company}`, html);
}

export async function sendHighMatch(
  userId: string,
  jobTitle: string,
  company: string,
  matchScore: number,
  jobId: string
) {
  const to = await getUserEmail(userId);
  if (!to) return;

  const html = wrap(`
    ${h2(`${matchScore}% match found`)}
    ${p(`JobsAI discovered a job that closely matches your profile:`)}
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:#111827;">${jobTitle}</p>
      <p style="margin:4px 0 0;color:#6b7280;font-size:14px;">${company}</p>
    </div>
    ${p("Enable auto-apply in your preferences to let JobsAI submit this automatically next time.", true)}
    ${btn(`${APP_URL}/dashboard/jobs/${jobId}`, "View job & apply")}
  `);

  await send(to, `${matchScore}% match: ${jobTitle} at ${company}`, html);
}

export interface DiscoverySummaryJob {
  title: string;
  company: string;
  jobId: string;
}

export async function sendDiscoverySummary(
  userId: string,
  importedJobs: DiscoverySummaryJob[]
) {
  if (importedJobs.length === 0) return;
  const to = await getUserEmail(userId);
  if (!to) return;

  const count = importedJobs.length;
  const listed = importedJobs.slice(0, 5);

  const rows = listed
    .map(
      (j) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">
            <a href="${APP_URL}/dashboard/jobs/${j.jobId}" style="color:#4f46e5;text-decoration:none;font-weight:500;">${j.title}</a>
            <span style="color:#9ca3af;font-size:13px;"> · ${j.company}</span>
          </td>
        </tr>`
    )
    .join("");

  const uurl = unsubUrl(userId);
  const html = wrap(`
    ${h2(`${count} new job${count > 1 ? "s" : ""} discovered`)}
    ${p(`JobsAI found ${count} new job${count > 1 ? "s" : ""} matching your preferences and added them to your pipeline.`)}
    <table style="width:100%;border-collapse:collapse;margin:16px 0;">${rows}</table>
    ${count > 5 ? p(`+${count - 5} more in your jobs list.`, true) : ""}
    ${btn(`${APP_URL}/dashboard/jobs`, "View all jobs")}
  `, uurl);

  await send(
    to,
    `JobsAI found ${count} new job${count > 1 ? "s" : ""} for you`,
    html,
    {
      "List-Unsubscribe": `<${uurl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    }
  );
}

// ─── Auto-apply daily digest ──────────────────────────────────────────────────

interface AutoApplyDigestJob { job_id: string; title: string; company: string; match_score: number | null }

// Auto-apply paused because the user ran out of credits — nudge them to top up
// so the continuous applying resumes.
export async function sendAutoApplyLowCredits(userId: string, applied: number) {
  const to = await getUserEmail(userId);
  if (!to) return;
  const html = wrap(`
    ${h2("Your auto-apply is paused — top up to keep going")}
    ${p(`Auto Apply has been working for you${applied ? ` and submitted <strong>${applied}</strong> applications` : ""}, but you're out of credits, so it's paused.`)}
    ${p("Top up and JobsAI will pick right back up — continuously finding and applying to matching jobs on your behalf.", true)}
    ${btn(`${APP_URL}/dashboard/billing`, "Top up credits")}
  `);
  await send(to, "Auto-apply paused — top up to keep applying", html);
}

export async function sendAutoApplyDigest(
  userId: string,
  data: { applied: AutoApplyDigestJob[]; manual: AutoApplyDigestJob[]; threshold: number }
) {
  const to = await getUserEmail(userId);
  if (!to) return;

  const { applied, manual, threshold } = data;
  const total = applied.length + manual.length;
  if (total === 0) return;

  const jobRow = (j: AutoApplyDigestJob, badge: string, color: string) =>
    `<tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
        <span style="font-weight:500;color:#111;">${j.title}</span>
        <span style="color:#9ca3af;font-size:13px;"> · ${j.company}</span>
        ${j.match_score != null ? `<span style="color:#9ca3af;font-size:12px;"> · ${j.match_score}% match</span>` : ""}
        <br/><span style="display:inline-block;margin-top:4px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:${color}20;color:${color};">${badge}</span>
      </td>
    </tr>`;

  const appliedRows = applied.map((j) => jobRow(j, "✓ Applied", "#16a34a")).join("");
  const manualRows = manual.map((j) => jobRow(j, "Needs your review", "#d97706")).join("");

  const html = wrap(`
    ${h2(`JobsAI applied to ${applied.length} job${applied.length !== 1 ? "s" : ""} while you were away`)}
    ${p(`Your auto-apply ran overnight. Here's what happened (threshold: ${threshold}% match):`)}

    ${applied.length > 0 ? `
      <p style="font-weight:600;margin:20px 0 8px;color:#111;">Applications submitted (${applied.length})</p>
      <table style="width:100%;border-collapse:collapse;">${appliedRows}</table>
    ` : ""}

    ${manual.length > 0 ? `
      <p style="font-weight:600;margin:20px 0 8px;color:#111;">Needs your review (${manual.length}) — ATS didn't support auto-submit</p>
      <table style="width:100%;border-collapse:collapse;">${manualRows}</table>
    ` : ""}

    ${p("Tailored résumé and cover letter saved for every job above.", true)}
    ${btn(`${APP_URL}/dashboard/auto-apply`, "View full activity log")}
    ${p(`To adjust your auto-apply settings or threshold, visit your <a href="${APP_URL}/dashboard/preferences" style="color:#4f46e5;">Preferences</a>.`, true)}
  `);

  await send(to, `JobsAI applied to ${applied.length} job${applied.length !== 1 ? "s" : ""} for you`, html);
}

// ─── Nurture drip letters ──────────────────────────────────────────────────────
// Recurring personalized engagement letters, sent one at a time on a paced
// cadence by /api/cron/nurture. `order` = sequence position; `minDays` = don't
// send before the account is this old (lets the welcome land first). Signed from
// the founder — swap `FOUNDER` for a real teammate persona if you add staff.

type Persona = { name: string; title: string; photo?: string | null };

const FOUNDER_PHOTO = "/team/hippolyte-asah.jpg";

// The founder — used only by the one-time welcome email (a personal note).
const FOUNDER: Persona = { name: "Hippolyte Asah", title: "Founder, JobsAI", photo: FOUNDER_PHOTO };

// Recurring subscriber nurture letters are signed by the talent team, not the
// founder. No photo on file → the avatar falls back to a clean initials disc.
const TALENT_MANAGER: Persona = { name: "Alex Bernier", title: "Talent Manager, JobsAI", photo: null };

// Avatar cell: a headshot on a colored disc when a photo is provided; otherwise
// a clean initials disc. The initials also serve as the image-blocked fallback,
// so no client ever shows a broken-image icon.
function avatarCell(name: string, size = 56, photo: string | null = FOUNDER_PHOTO): string {
  const initials =
    name.trim().split(/\s+/).map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase() || "JA";
  const r = Math.round(size / 2);
  const disc = `width:${size}px;height:${size}px;background:#4f46e5;border-radius:${r}px;color:#ffffff;font-size:${Math.round(size * 0.36)}px;font-weight:800;text-align:center;line-height:${size}px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;`;
  const inner = photo
    ? `<img src="${APP_URL}${photo}" width="${size}" height="${size}" alt="${escapeHtml(initials)}" style="width:${size}px;height:${size}px;border-radius:${r}px;display:block;object-fit:cover;border:1px solid rgba(255,255,255,0.25);" />`
    : escapeHtml(initials);
  return `<td width="${size}" height="${size}" align="center" valign="middle" style="${disc}">${inner}</td>`;
}

function personaSignoff(persona: Persona): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
      <tr>
        ${avatarCell(persona.name, 56, persona.photo ?? null)}
        <td style="width:14px;">&nbsp;</td>
        <td style="vertical-align:middle;">
          <p style="margin:0;font-size:15px;font-weight:700;color:#111827;">${escapeHtml(persona.name)}</p>
          <p style="margin:1px 0 0;font-size:13px;color:#6b7280;">${escapeHtml(persona.title)}</p>
        </td>
      </tr>
    </table>`;
}

export interface NurtureLetterMeta { key: string; order: number; minDays: number }

// Ordered sequence — the cron sends the lowest-order unsent letter that's due.
export const NURTURE_LETTERS: NurtureLetterMeta[] = [
  { key: "resume-review",  order: 1, minDays: 3 },
  { key: "auto-apply",     order: 2, minDays: 8 },
  { key: "interview-prep", order: 3, minDays: 15 },
];

function nurtureBody(key: string, hi: string): { subject: string; body: string } | null {
  switch (key) {
    case "resume-review":
      return {
        subject: "A quick second opinion on your résumé",
        body: `
          ${h2("Is your résumé getting you interviews? 📄")}
          ${p(hi)}
          ${p(`A second opinion on your résumé can be the difference between landing the interview and getting filtered out by an ATS before a human ever sees it.`)}
          ${p(`Run yours through the JobsAI <strong>ATS Scanner</strong> — in seconds you'll see your match score for any role, the keywords you're missing, and exactly what to fix.`)}
          ${btn(`${APP_URL}/dashboard/resumes`, "Get your free résumé review")}
          ${p(`Already happy with it? Tailor it to a specific role in one click from any job in your list.`, true)}
          ${p(`We're here to help you land your next role.`)}
          ${personaSignoff(TALENT_MANAGER)}`,
      };
    case "auto-apply":
      return {
        subject: "Let JobsAI do the applying for you",
        body: `
          ${h2("Stop filling out the same forms 🤖")}
          ${p(hi)}
          ${p(`Applying shouldn't eat your evenings. With <strong>Auto-Apply</strong>, JobsAI finds roles that match you and applies on your behalf — you pick how much control you want:`)}
          ${p(`✅ <strong>Auto</strong> — apply to strong matches automatically<br>✅ <strong>Hybrid</strong> — we apply to the best, you approve the rest<br>✅ <strong>Review</strong> — nothing goes out without your say-so`)}
          ${btn(`${APP_URL}/dashboard/auto-apply`, "Turn on Auto-Apply")}
          ${p(`You stay in control — and you're only charged when an application actually goes through.`, true)}
          ${personaSignoff(TALENT_MANAGER)}`,
      };
    case "interview-prep":
      return {
        subject: "Walk into your next interview ready",
        body: `
          ${h2("Rehearse before it counts 🎯")}
          ${p(hi)}
          ${p(`Getting the interview is half the battle — the other half is walking in prepared. JobsAI gives you an <strong>AI interview coach</strong>, realistic voice practice, and company-specific likely questions so nothing catches you off guard.`)}
          ${btn(`${APP_URL}/dashboard/jobs`, "Practice for an interview")}
          ${p(`Open any job in your list and tap Interview Prep to start.`, true)}
          ${p(`Rooting for you.`)}
          ${personaSignoff(TALENT_MANAGER)}`,
      };
    default:
      return null;
  }
}

// Send one nurture letter to a user (with one-click unsubscribe). Returns the
// real send result so the cron only records a send that actually went out.
export async function sendNurtureEmail(opts: {
  userId: string; to: string; firstName?: string | null; key: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!resend) return { ok: false, error: "RESEND_API_KEY not configured" };
  const name = (opts.firstName || "").trim();
  const hi = name ? `Hi ${escapeHtml(name)},` : "Hi there,";
  const letter = nurtureBody(opts.key, hi);
  if (!letter) return { ok: false, error: `Unknown nurture key: ${opts.key}` };

  const uurl = unsubUrl(opts.userId);
  const { error } = await resend.emails.send({
    from: FROM,
    to: opts.to,
    subject: letter.subject,
    html: wrap(letter.body, uurl),
    headers: { "List-Unsubscribe": `<${uurl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  });
  if (error) {
    console.error("[email] nurture send failed:", error);
    return { ok: false, error: (error as { message?: string }).message ?? String(error) };
  }
  return { ok: true };
}
