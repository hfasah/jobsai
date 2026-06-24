import { createHmac, timingSafeEqual } from "crypto";

// Signed, login-free unsubscribe links for alert emails. The token is an HMAC of
// the user id, so a link can't be forged for another user, and no DB token table
// is needed. Used by the email footer link + the RFC-8058 one-click header.

const SECRET = process.env.EMAIL_UNSUB_SECRET || process.env.CRON_SECRET || "jobsai-email-unsub";
const BASE = (process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work").replace(/\/$/, "");

export function unsubToken(userId: string): string {
  return createHmac("sha256", SECRET).update(`unsub:${userId}`).digest("hex").slice(0, 32);
}

export function verifyUnsub(userId: string, token: string): boolean {
  if (!userId || !token) return false;
  const expected = unsubToken(userId);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function unsubUrl(userId: string): string {
  return `${BASE}/api/email/unsubscribe?u=${encodeURIComponent(userId)}&t=${unsubToken(userId)}`;
}
