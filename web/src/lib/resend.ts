import { Resend } from "resend";

// Fallback prevents build-time crash when env var is absent; real sends require the key at runtime
export const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");

export const FROM_SUPPORT = "JobsAI Support <support@jobsai.work>";
export const SUPPORT_EMAIL = "support@jobsai.work";
