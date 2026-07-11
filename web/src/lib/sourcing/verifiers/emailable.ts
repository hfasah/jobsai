// Emailable verification adapter (https://emailable.com — simple GET API).
// Swappable behind the EmailVerifier interface; selected via
// EMAIL_VERIFIER_PROVIDER=emailable + EMAIL_VERIFIER_API_KEY.
import type { EmailVerifier } from "../provider";
import type { VerifyResult } from "../types";

export const emailableVerifier: EmailVerifier = {
  key: "emailable",
  async verify(email, opts): Promise<VerifyResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const params = new URLSearchParams({ email, api_key: opts.apiKey });
      const res = await fetch(`https://api.emailable.com/v1/verify?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) return { status: "unknown" };
      const json = (await res.json()) as { state?: string };
      // Emailable states: deliverable | undeliverable | risky | unknown
      const map: Record<string, VerifyResult["status"]> = {
        deliverable: "valid",
        undeliverable: "invalid",
        risky: "risky",
        unknown: "unknown",
      };
      return { status: map[json.state ?? "unknown"] ?? "unknown", raw: json };
    } catch {
      return { status: "unknown" };
    } finally {
      clearTimeout(timer);
    }
  },
};
