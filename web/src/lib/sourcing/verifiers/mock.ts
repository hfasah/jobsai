// Deterministic mock verifier: valid unless the mailbox name hints otherwise.
import type { EmailVerifier } from "../provider";
import type { VerifyResult } from "../types";

export const mockVerifier: EmailVerifier = {
  key: "mock",
  async verify(email: string): Promise<VerifyResult> {
    const box = email.split("@")[0]?.toLowerCase() ?? "";
    if (box.includes("invalid") || box.includes("bounce")) return { status: "invalid" };
    if (box.includes("risky") || box.startsWith("info") || box.startsWith("admin")) return { status: "risky" };
    return { status: "valid" };
  },
};
