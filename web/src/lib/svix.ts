// Verify a Svix-signed webhook (used by Clerk and Resend).
// signedContent = `${svix-id}.${svix-timestamp}.${rawBody}`
// signature = base64( HMAC-SHA256(secretBytes, signedContent) ), compared
// against the v1 entries in the svix-signature header.

import crypto from "crypto";

export function verifySvix(secret: string | undefined, headers: Headers, rawBody: string): boolean {
  if (!secret) {
    console.warn("[svix] no signing secret configured — skipping verification");
    return true;
  }
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(`${id}.${ts}.${rawBody}`)
    .digest("base64");
  const expectedBuf = Buffer.from(expected);

  return sigHeader.split(" ").some((part) => {
    const sig = part.split(",")[1];
    if (!sig) return false;
    const sigBuf = Buffer.from(sig);
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}
