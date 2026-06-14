import { Resend } from "resend";

// Fallback prevents build-time crash when env var is absent; real sends require the key at runtime
export const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");

// Send from the verified sending subdomain (send.jobsai.work) to protect the
// root domain's reputation and ensure deliverability. Replies route to the real
// monitored inbox via SUPPORT_EMAIL (set as reply-to on outgoing mail).
export const FROM_SUPPORT = "JobsAI Support <support@send.jobsai.work>";
export const SUPPORT_EMAIL = "support@jobsai.work";

// Reply-to for support/auto-reply mail. Set SUPPORT_REPLY_TO to an address on a
// Resend *receiving* subdomain (e.g. support@reply.jobsai.work) to route customer
// replies into the inbound webhook → admin Support Inbox. Defaults to the real
// monitored mailbox so replies still reach a human if inbound isn't set up.
export const REPLY_TO_SUPPORT = process.env.SUPPORT_REPLY_TO ?? SUPPORT_EMAIL;
