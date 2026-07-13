-- Org-wide Do-Not-Contact / suppression for recruiter outreach.
--
-- This is the SENDING suppression list (distinct from sourcing_suppressions,
-- which is a do-not-SOURCE filter for the candidate-search UI). Every outbound
-- campaign path must consult this: at enrollment, and again immediately before
-- each send. A suppressed address is never emailed, across all campaigns and
-- senders in the org.
--
-- Privacy: we keep normalized_email + a sha256 email_hash so a suppression can
-- survive candidate-profile deletion without retaining unnecessary PII.
create table if not exists enterprise_suppressions (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references enterprise_orgs(id) on delete cascade,
  normalized_email   text not null,                 -- lower(trim(email))
  email_hash         text,                          -- sha256(normalized_email)
  reason             text not null default 'other'
                     check (reason in (
                       'explicit_unsubscribe','do_not_contact_request','not_interested',
                       'spam_complaint','hard_bounce','invalid_address','privacy_request',
                       'legal_request','recruiter_added','admin_added','other')),
  source             text not null default 'api'
                     check (source in (
                       'inbound_reply','resend_webhook','recruiter_action','admin_action',
                       'csv_import','api','automated_rule')),
  source_campaign_id uuid,
  source_message_id  text,
  created_by         text,                           -- clerk userId (null = system)
  notes              text,
  expires_at         timestamptz,                    -- null = permanent
  active             boolean not null default true,
  legal_hold         boolean not null default false, -- can't be reactivated without review
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (org_id, normalized_email)
);

create index if not exists enterprise_suppressions_lookup_idx
  on enterprise_suppressions (org_id, normalized_email) where active;

-- Opaque per-enrollment unsubscribe token for the one-click / footer link, so
-- the public route never exposes org/campaign/candidate ids. Volatile default
-- backfills existing rows with distinct tokens.
alter table enterprise_campaign_enrollments
  add column if not exists unsubscribe_token uuid default gen_random_uuid();

create unique index if not exists enterprise_campaign_enrollments_unsub_token_idx
  on enterprise_campaign_enrollments (unsubscribe_token);
