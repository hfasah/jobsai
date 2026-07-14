-- One-time backfill: mirror already-owned sourcing leads (revealed before the
-- auto-sync in PR #382) into the Recruiting CRM, so the team can research /
-- track / re-contact them there too. Idempotent (NOT EXISTS guards + DISTINCT
-- ON), safe to run more than once. Only leads with a revealed email are synced.
--
-- CRM rows need a created_by (clerk userId); sourcing_external_candidates has
-- none, so attribute to the org's owner (then admin, then any member).

-- 1) Companies — dedup by case-insensitive name.
with org_user as (
  select distinct on (org_id) org_id, user_id
  from enterprise_members
  order by org_id, case role when 'owner' then 0 when 'admin' then 1 else 2 end
)
insert into crm_companies (org_id, name, source, created_by)
select distinct on (c.org_id, lower(c.company))
  c.org_id, c.company, 'sourcing', ou.user_id
from sourcing_external_candidates c
join org_user ou on ou.org_id = c.org_id
where c.profile_unlocked = true
  and coalesce(c.company, '') <> ''
  and jsonb_array_length(coalesce(c.emails, '[]'::jsonb)) > 0
  and not exists (
    select 1 from crm_companies co
    where co.org_id = c.org_id and lower(co.name) = lower(c.company)
  );

-- 2) Contacts — dedup by case-insensitive email; link to the company by name.
with org_user as (
  select distinct on (org_id) org_id, user_id
  from enterprise_members
  order by org_id, case role when 'owner' then 0 when 'admin' then 1 else 2 end
)
insert into crm_contacts (org_id, company_id, first_name, last_name, title, email, phone, linkedin_url, contact_type, tags, notes, created_by)
select distinct on (c.org_id, lower(c.emails->0->>'value'))
  c.org_id,
  co.id,
  coalesce(nullif(c.first_name, ''), split_part(coalesce(c.full_name, c.emails->0->>'value'), ' ', 1)),
  nullif(c.last_name, ''),
  nullif(c.job_title, ''),
  lower(c.emails->0->>'value'),
  c.phones->0->>'value',
  c.linkedin_url,
  'other',
  coalesce(c.skills[1:12], '{}'),
  'Added automatically from Global Sourcing',
  ou.user_id
from sourcing_external_candidates c
join org_user ou on ou.org_id = c.org_id
left join crm_companies co on co.org_id = c.org_id and lower(co.name) = lower(c.company)
where c.profile_unlocked = true
  and jsonb_array_length(coalesce(c.emails, '[]'::jsonb)) > 0
  and (c.emails->0->>'value') is not null
  and not exists (
    select 1 from crm_contacts ct
    where ct.org_id = c.org_id and lower(ct.email) = lower(c.emails->0->>'value')
  );
