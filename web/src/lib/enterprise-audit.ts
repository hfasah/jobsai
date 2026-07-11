import { supabaseAdmin } from "@/lib/supabase";

export type AuditAction =
  | "job.created" | "job.updated" | "job.published" | "job.closed"
  | "candidate.applied" | "candidate.stage_moved" | "candidate.screened" | "candidate.pool_added"
  | "interview.kit_generated" | "interview.invited" | "interview.completed"
  | "member.invited" | "member.role_changed" | "member.removed"
  | "integration.connected" | "integration.synced" | "integration.disconnected"
  | "ats.connected" | "ats.synced" | "ats.disconnected"
  | "data.exported" | "data.deleted"
  | "sourcing.search_executed" | "sourcing.contact_revealed" | "sourcing.profile_enriched"
  | "sourcing.candidate_imported" | "sourcing.results_exported" | "sourcing.candidate_suppressed"
  | "sourcing.provider_updated" | "sourcing.credits_adjusted";

interface AuditEntry {
  org_id: string;
  user_id?: string;
  action: AuditAction;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
}

export async function audit(entry: AuditEntry): Promise<void> {
  supabaseAdmin.from("enterprise_audit_logs").insert(entry).then(() => {}, console.error);
}
