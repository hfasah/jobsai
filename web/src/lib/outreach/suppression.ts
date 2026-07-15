// Org-wide Do-Not-Contact enforcement for outbound recruiter outreach. Every
// send path (enroll + cron) must consult this. SERVER-ONLY.
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { normEmail } from "@/lib/sourcing/normalize";
import { audit } from "@/lib/enterprise-audit";

export type SuppressionReason =
  | "explicit_unsubscribe" | "do_not_contact_request" | "not_interested"
  | "spam_complaint" | "hard_bounce" | "invalid_address" | "privacy_request"
  | "legal_request" | "recruiter_added" | "admin_added" | "other";
export type SuppressionSource =
  | "inbound_reply" | "resend_webhook" | "recruiter_action" | "admin_action"
  | "csv_import" | "api" | "automated_rule";

export function emailHash(normalized: string): string {
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

// Batched suppression lookup — returns the set of NORMALIZED emails that are
// actively suppressed for the org (respecting expiry). Chunked for large lists.
export async function loadSuppressedSet(orgId: string, emails: string[]): Promise<Set<string>> {
  const norm = [...new Set(emails.map((e) => normEmail(e)).filter(Boolean))] as string[];
  const set = new Set<string>();
  if (norm.length === 0) return set;
  const nowIso = new Date().toISOString();
  for (let i = 0; i < norm.length; i += 200) {
    const chunk = norm.slice(i, i + 200);
    const { data } = await supabaseAdmin
      .from("enterprise_suppressions")
      .select("normalized_email, expires_at")
      .eq("org_id", orgId).eq("active", true).in("normalized_email", chunk);
    for (const r of data ?? []) {
      if (!r.expires_at || (r.expires_at as string) > nowIso) set.add(r.normalized_email as string);
    }
  }
  return set;
}

// Single-email check (convenience for non-batch call sites).
export async function isEmailSuppressed(orgId: string, email: string): Promise<boolean> {
  const norm = normEmail(email);
  if (!norm) return false;
  return (await loadSuppressedSet(orgId, [norm])).has(norm);
}

// Undo a suppression (e.g. the classifier misread a quoted footer as an
// opt-out). Deactivates rather than deletes — the history stays auditable.
// Returns how many rows were deactivated.
export async function unsuppressEmail(orgId: string, email: string): Promise<number> {
  const norm = normEmail(email);
  if (!norm) return 0;
  const { data } = await supabaseAdmin
    .from("enterprise_suppressions")
    .update({ active: false })
    .eq("org_id", orgId)
    .eq("normalized_email", norm)
    .eq("active", true)
    .select("id");
  return (data ?? []).length;
}

// Record (or refresh) an org-wide suppression. Idempotent per (org, email):
// re-suppressing an address reactivates it and updates the reason/source.
export async function suppressEmail(args: {
  orgId: string; email: string; reason: SuppressionReason; source: SuppressionSource;
  campaignId?: string | null; messageId?: string | null; createdBy?: string | null;
  notes?: string | null; expiresAt?: string | null;
}): Promise<boolean> {
  const norm = normEmail(args.email);
  if (!norm) return false;
  const { error } = await supabaseAdmin.from("enterprise_suppressions").upsert({
    org_id: args.orgId,
    normalized_email: norm,
    email_hash: emailHash(norm),
    reason: args.reason,
    source: args.source,
    source_campaign_id: args.campaignId ?? null,
    source_message_id: args.messageId ?? null,
    created_by: args.createdBy ?? null,
    notes: args.notes ?? null,
    expires_at: args.expiresAt ?? null,
    active: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: "org_id,normalized_email" });
  if (error) {
    console.error("[suppression] suppressEmail failed", error.message);
    return false;
  }
  audit({
    org_id: args.orgId,
    user_id: args.createdBy ?? undefined,
    action: "outreach.contact_suppressed",
    resource_type: "suppression",
    metadata: { reason: args.reason, source: args.source, email_hash: emailHash(norm) },
  });
  return true;
}
