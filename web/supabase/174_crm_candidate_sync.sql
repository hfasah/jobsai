-- 174: every candidate in the CRM — applicants + talent pool mirror into
-- crm_contacts (sourced leads already do via lib/sourcing/crm-sync + mig 167).
-- Adds candidate links + origin, then backfills existing candidates.

alter table crm_contacts add column if not exists source text; -- applicant | talent_pool | sourcing | null (manual)
alter table crm_contacts add column if not exists application_id uuid references enterprise_applications(id) on delete set null;
alter table crm_contacts add column if not exists talent_pool_id uuid references enterprise_talent_pool(id) on delete set null;
create index if not exists idx_crm_contacts_email_lower on crm_contacts(org_id, lower(email));

-- Backfill applicants: one contact per (org, email); newest application wins the link.
insert into crm_contacts (org_id, first_name, last_name, email, phone, contact_type, source, application_id, notes, created_by)
select distinct on (a.org_id, lower(a.candidate_email))
  a.org_id,
  split_part(coalesce(nullif(trim(a.candidate_name), ''), split_part(a.candidate_email, '@', 1)), ' ', 1),
  nullif(array_to_string((string_to_array(trim(coalesce(a.candidate_name, '')), ' '))[2:], ' '), ''),
  lower(a.candidate_email),
  a.candidate_phone,
  'candidate',
  'applicant',
  a.id,
  'Added automatically from Applicants (backfill)',
  'auto-sync'
from enterprise_applications a
where coalesce(a.candidate_email, '') <> ''
  and not exists (
    select 1 from crm_contacts cc
    where cc.org_id = a.org_id and lower(cc.email) = lower(a.candidate_email)
  )
order by a.org_id, lower(a.candidate_email), a.created_at desc;

-- Backfill talent pool entries that still have no contact.
insert into crm_contacts (org_id, first_name, last_name, email, phone, linkedin_url, contact_type, source, talent_pool_id, notes, created_by)
select distinct on (t.org_id, lower(t.candidate_email))
  t.org_id,
  split_part(coalesce(nullif(trim(t.candidate_name), ''), split_part(t.candidate_email, '@', 1)), ' ', 1),
  nullif(array_to_string((string_to_array(trim(coalesce(t.candidate_name, '')), ' '))[2:], ' '), ''),
  lower(t.candidate_email),
  t.candidate_phone,
  t.linkedin_url,
  'candidate',
  'talent_pool',
  t.id,
  'Added automatically from the Talent Pool (backfill)',
  'auto-sync'
from enterprise_talent_pool t
where coalesce(t.candidate_email, '') <> ''
  and not exists (
    select 1 from crm_contacts cc
    where cc.org_id = t.org_id and lower(cc.email) = lower(t.candidate_email)
  )
order by t.org_id, lower(t.candidate_email), t.created_at desc;

-- Link existing contacts that were missing their candidate references
-- (covers contacts created by the applicant backfill above too).
update crm_contacts cc
set talent_pool_id = t.id
from enterprise_talent_pool t
where cc.org_id = t.org_id
  and lower(cc.email) = lower(t.candidate_email)
  and cc.talent_pool_id is null;

update crm_contacts cc
set application_id = a.id
from enterprise_applications a
where cc.org_id = a.org_id
  and lower(cc.email) = lower(a.candidate_email)
  and cc.application_id is null;
