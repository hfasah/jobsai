import { Resend } from "resend";
import type { SkyvernFailureKind } from "@/lib/skyvern";

// Ops/admin alerting for systemic failures the CLIENT must never see the detail
// of (e.g. "Skyvern out of credits"). Emails the ops inbox so the admin can fix
// it (top up, rotate key) without the user being aware of the technical reason.

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.NOTIFICATION_FROM_EMAIL ?? "JobsAI <notifications@jobsai.work>";
const OPS_EMAIL = process.env.OPS_ALERT_EMAIL ?? process.env.SUPPORT_EMAIL ?? "everybrainai@gmail.com";

// Throttle so an outage with steady traffic doesn't flood the inbox. Module-level
// (per warm serverless instance) — best-effort; a few mails during an outage, not
// hundreds. `source:"user"` (explicit "Notify support" clicks) is throttled more
// loosely so real user signals still land.
const THROTTLE_MS = 30 * 60 * 1000;
const lastSent = new Map<string, number>();

export interface AgentApplyDownAlert {
  kind: SkyvernFailureKind | "unknown";
  detail: string;
  source: "auto" | "user";
  userId?: string;
  jobId?: string;
}

export async function notifyAgentApplyDown(a: AgentApplyDownAlert): Promise<void> {
  const throttleKey = `${a.source}:${a.kind}`;
  const now = Date.now();
  const window = a.source === "user" ? 10 * 60 * 1000 : THROTTLE_MS;
  const prev = lastSent.get(throttleKey) ?? 0;
  if (now - prev < window) return;
  // NOTE: only record lastSent AFTER a confirmed send (below) — recording here
  // would let a failed/killed send poison the throttle and suppress retries.

  if (!resend) {
    console.warn("[ops-alert] RESEND_API_KEY not configured — would alert:", a);
    return;
  }

  const subjectKind = a.kind === "credits" ? "OUT OF CREDITS"
    : a.kind === "auth" ? "BAD/MISSING API KEY"
    : a.kind === "rate_limit" ? "RATE-LIMITED"
    : a.kind === "outage" ? "OUTAGE"
    : "FAILURE";

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto">
      <h2 style="margin:0 0 8px">⚠️ Auto-apply unavailable for clients — ${subjectKind}</h2>
      <p style="margin:0 0 12px;color:#444">The browser-agent (Skyvern) is failing for client auto-apply. Clients see only a neutral "temporarily unavailable" notice.</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Reason</td><td><strong>${a.detail}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Kind</td><td>${a.kind}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Trigger</td><td>${a.source === "user" ? "Client clicked “Notify support”" : "Detected automatically"}</td></tr>
        ${a.userId ? `<tr><td style="padding:4px 12px 4px 0;color:#666">User</td><td>${a.userId}</td></tr>` : ""}
        ${a.jobId ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Job</td><td>${a.jobId}</td></tr>` : ""}
      </table>
      <p style="margin:16px 0 0;color:#444">Action: ${a.kind === "credits" ? "Top up the Skyvern account." : a.kind === "auth" ? "Rotate/replace SKYVERN_API_KEY." : "Check Skyvern status, then retry."}</p>
    </div>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: OPS_EMAIL,
      subject: `⚠️ Auto-apply DOWN for clients — ${subjectKind}`,
      html,
    });
    if (error) { console.error("[ops-alert] send failed:", error); return; }
    lastSent.set(throttleKey, now); // throttle only after a confirmed send
  } catch (err) {
    console.error("[ops-alert] send threw:", err);
  }
}
