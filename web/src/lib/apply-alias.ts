// Per-application inbound email aliases.
//
// Every agent application is submitted with a unique alias instead of the user's
// real email. Employer replies arrive at that alias, so we can match each reply
// to the exact application (no fuzzy company matching) and forward a copy on.

import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";

// Subdomain that receives inbound mail (MX pointed at Resend).
export const INBOUND_DOMAIN = (process.env.INBOUND_EMAIL_DOMAIN ?? "apply.jobsai.work")
  .replace(/^@/, "")
  .toLowerCase();

// Only apply with platform aliases once inbound receiving is actually live
// (DNS/MX + Resend inbound configured) — otherwise employer replies would
// bounce. Flip INBOUND_EMAIL_ENABLED=true after setup.
export function inboundEmailEnabled(): boolean {
  return process.env.INBOUND_EMAIL_ENABLED === "true";
}

function newToken(): string {
  // 14 lowercase hex chars — url/email-safe, unguessable, collision-resistant.
  return randomBytes(7).toString("hex");
}

/**
 * Get the existing inbound alias for a (user, job), or create one.
 * Returns the full alias email, e.g. "a1b2c3d4e5f6a7@apply.jobsai.work".
 */
export async function getOrCreateAlias(userId: string, jobId: string): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("apply_aliases")
    .select("alias_email")
    .eq("user_id", userId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (existing?.alias_email) return existing.alias_email;

  // Try up to a few times in case of a token collision.
  for (let i = 0; i < 5; i++) {
    const token = newToken();
    const aliasEmail = `${token}@${INBOUND_DOMAIN}`;
    const { error } = await supabaseAdmin.from("apply_aliases").insert({
      token,
      alias_email: aliasEmail,
      user_id: userId,
      job_id: jobId,
    });
    if (!error) return aliasEmail;
    // Unique violation on (user_id, job_id) → another request created it; reuse.
    if (error.code === "23505") {
      const { data } = await supabaseAdmin
        .from("apply_aliases")
        .select("alias_email")
        .eq("user_id", userId)
        .eq("job_id", jobId)
        .maybeSingle();
      if (data?.alias_email) return data.alias_email;
    }
  }
  throw new Error("Could not allocate an inbound alias");
}

/** Resolve an inbound alias address back to its owner + job. */
export async function lookupAlias(
  aliasEmail: string
): Promise<{ user_id: string; job_id: string } | null> {
  const normalized = aliasEmail.trim().toLowerCase();
  const { data } = await supabaseAdmin
    .from("apply_aliases")
    .select("user_id, job_id")
    .eq("alias_email", normalized)
    .maybeSingle();
  return data ?? null;
}

/** Pick the address in a To/Cc list that belongs to our inbound domain. */
export function findOurAlias(addresses: (string | null | undefined)[]): string | null {
  for (const a of addresses) {
    if (!a) continue;
    // Address may be "Name <token@domain>" or bare "token@domain".
    const m = a.match(/<([^>]+)>/);
    const addr = (m ? m[1] : a).trim().toLowerCase();
    if (addr.endsWith(`@${INBOUND_DOMAIN}`)) return addr;
  }
  return null;
}
