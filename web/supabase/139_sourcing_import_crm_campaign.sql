-- Sourcing → CRM / cold-outreach bridge: allow importing a sourced candidate
-- as a CRM contact or straight into a cold-email campaign, so search feeds the
-- outreach workflow directly.
alter table sourcing_imports drop constraint if exists sourcing_imports_target_type_check;
alter table sourcing_imports add constraint sourcing_imports_target_type_check
  check (target_type in ('talent_pool', 'job', 'intake', 'crm_contact', 'campaign'));

-- Provenance columns for the new targets (nullable; existing rows unaffected).
alter table sourcing_imports
  add column if not exists crm_contact_id uuid,
  add column if not exists campaign_id    uuid,
  add column if not exists enrollment_id  uuid;
