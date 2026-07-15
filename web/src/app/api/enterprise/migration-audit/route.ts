import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getMyOrg } from "@/lib/enterprise";

export const maxDuration = 60;

// One representative schema artifact per migration (090+). A migration that
// ran leaves its table/column behind; probing for it tells us whether the
// migration was applied — the only verification possible without direct DB
// access. `column` omitted = table-existence probe.
const PROBES: { mig: string; table: string; column?: string }[] = [
  { mig: "090_outreach_campaigns", table: "enterprise_campaigns" },
  { mig: "091_support_messages", table: "support_messages" },
  { mig: "092_support_inbox_folders", table: "support_tickets", column: "read_at" },
  { mig: "093_plan_yearly_prices", table: "plans", column: "stripe_price_id_yearly" },
  { mig: "094_enterprise_intake", table: "enterprise_intake" },
  { mig: "095_loxo_ats", table: "enterprise_ats_connections", column: "agency_slug" },
  { mig: "096_enterprise_org_phone", table: "enterprise_orgs", column: "phone" },
  { mig: "097_partner_program", table: "partner_accounts" },
  { mig: "098_partner_founding", table: "partner_accounts", column: "is_founding" },
  { mig: "099_partner_admin", table: "partner_payouts" },
  { mig: "100_partner_self_serve", table: "partner_accounts", column: "verified" },
  { mig: "101_partner_portal_token", table: "partner_accounts", column: "portal_token" },
  { mig: "110_accomplishment_facts", table: "accomplishment_facts" },
  { mig: "111_enterprise_quotes", table: "enterprise_quotes" },
  { mig: "112_sales_deals", table: "sales_deals" },
  { mig: "113_candidate_intake", table: "enterprise_orgs", column: "intake_email_handle" },
  { mig: "114_ui_translation_cache", table: "ui_translation_cache" },
  { mig: "116_blog_posts", table: "blog_posts" },
  { mig: "117_crm_core", table: "crm_contacts" },
  { mig: "118_crm_job_orders_deals", table: "crm_deals" },
  { mig: "119_crm_submissions", table: "crm_submissions" },
  { mig: "120_enterprise_reply_to", table: "enterprise_orgs", column: "reply_to_email" },
  { mig: "121_intake_forwarding_confirmation", table: "enterprise_orgs", column: "intake_forward_code" },
  { mig: "122_crm_pipedrive_links", table: "crm_pipedrive_links" },
  { mig: "123_application_resume_file", table: "enterprise_applications", column: "resume_storage_key" },
  { mig: "124_enterprise_messages", table: "enterprise_messages" },
  { mig: "125_candidate_location", table: "enterprise_applications", column: "candidate_location" },
  { mig: "126_talent_pool_groups", table: "enterprise_talent_pool_groups" },
  { mig: "127_talent_pool_multi_membership", table: "enterprise_talent_pool_memberships" },
  { mig: "128_job_salary_period", table: "enterprise_jobs", column: "salary_period" },
  { mig: "129_sourcing_core", table: "sourcing_external_candidates" },
  { mig: "130_sourcing_credits", table: "sourcing_credit_ledger" },
  { mig: "132_sourcing_permissions", table: "enterprise_role_permissions", column: "can_source_external" },
  { mig: "133_sourcing_polish", table: "sourcing_org_settings", column: "daily_credit_limit" },
  { mig: "134_outreach_sending", table: "sending_mailboxes" },
  { mig: "135_campaign_engine_v2 (campaigns)", table: "enterprise_campaigns", column: "send_window_start" },
  { mig: "135_campaign_engine_v2 (steps)", table: "enterprise_campaign_steps", column: "ab_subject" },
  { mig: "136_master_inbox", table: "inbox_threads" },
  { mig: "137_agency_workspaces", table: "enterprise_orgs", column: "parent_org_id" },
  { mig: "139_sourcing_import_crm_campaign", table: "sourcing_imports", column: "campaign_id" },
  { mig: "140_inbox_interest_level", table: "inbox_threads", column: "interest_level" },
  { mig: "141_ai_sdr (tables)", table: "ai_sdr_knowledge" },
  { mig: "141_ai_sdr (campaign cols)", table: "enterprise_campaigns", column: "ai_sdr_enabled" },
  { mig: "143_ai_sdr_permissions", table: "enterprise_role_permissions", column: "can_manage_ai_sdr" },
  { mig: "144_ai_sdr_hardening", table: "enterprise_orgs", column: "ai_sdr_paused" },
  { mig: "144_ai_sdr_hardening (messages)", table: "enterprise_messages", column: "sent_via" },
  { mig: "145_campaign_objective", table: "enterprise_campaigns", column: "objective" },
  { mig: "146_enrollment_email_status", table: "enterprise_campaign_enrollments", column: "email_status" },
  { mig: "150_campaign_pilot", table: "enterprise_campaigns", column: "pilot_size" },
  { mig: "151_campaign_schedule", table: "enterprise_campaigns", column: "scheduled_at" },
  { mig: "154_campaign_subsequences", table: "enterprise_campaign_subsequences" },
  { mig: "155_campaign_options", table: "enterprise_campaigns", column: "track_opens" },
  { mig: "157_campaign_mailbox_strategy", table: "enterprise_campaigns", column: "mailbox_strategy" },
  { mig: "158_campaign_send_controls", table: "enterprise_campaigns", column: "daily_send_limit" },
  { mig: "159_campaign_step_conditions", table: "enterprise_campaign_steps", column: "skip_if_in_pipeline" },
  { mig: "160_outreach_suppression (table)", table: "enterprise_suppressions" },
  { mig: "160_outreach_suppression (token)", table: "enterprise_campaign_enrollments", column: "unsubscribe_token" },
  { mig: "161_enrollment_sender_lock", table: "enterprise_campaign_enrollments", column: "mailbox_id" },
  { mig: "162_webhook_dedup", table: "outreach_webhook_events" },
];

// Migrations with no probeable schema artifact (check-constraint widenings,
// plpgsql function updates, seed/backfill data, index-only changes).
const NOT_PROBEABLE = [
  "102/103 demo bookings (created then dropped — net no-op)",
  "115_admin_delete_user (function)",
  "131_sourcing_entitlements (seed data)",
  "138_free_search_trial_credits (seed/function)",
  "142_ai_sdr_entitlements (seed data)",
  "147_inbox_intent_categories (check widening)",
  "148_ai_sdr_manual_mode (check widening)",
  "149_campaign_lifecycle (check widening)",
  "152_campaign_send_idempotency (unique index)",
  "153_enrollment_paused (check widening)",
  "156_campaign_error_status (check widening)",
  "163_full_contact_unlock (check widening — verified working: unlock spends charged)",
  "164_fix_grant_credits_drain (function — verified working: balance repaired to 2700)",
  "165_apollo_provider (check widening — env path in use, row optional)",
  "166_backfill_unmasked_names (data backfill — verified: names un-masked)",
  "167_backfill_leads_to_crm (data backfill — verify: CRM Contacts populated)",
];

// GET /api/enterprise/migration-audit — probes the live database for each
// migration's schema artifact and reports applied vs MISSING. Built after
// migrations 158/159 turned out to have never been run, silently breaking the
// campaign send cron.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = await getMyOrg(userId);
  if (!org) return NextResponse.json({ error: "No organization." }, { status: 404 });

  const results = await Promise.all(
    PROBES.map(async (p) => {
      const { error } = await supabaseAdmin
        .from(p.table)
        .select(p.column ?? "*", { count: "exact", head: true })
        .limit(1);
      return { ...p, ok: !error, error: error ? error.message.slice(0, 120) : undefined };
    }),
  );

  const missing = results.filter((r) => !r.ok);
  const applied = results.filter((r) => r.ok).map((r) => r.mig);

  return NextResponse.json({
    checked: results.length,
    applied_count: applied.length,
    missing_count: missing.length,
    missing, // ← run these migration files in Supabase
    applied,
    not_probeable: NOT_PROBEABLE,
  });
}
