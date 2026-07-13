-- One-time backfill: un-mask names revealed BEFORE the reveal path started
-- persisting the real name (PR #379). The paid Apollo/PDL match payload was
-- already stored in sourcing_external_candidates.raw, so the true name is
-- recoverable — we just never copied it onto the display columns.
--
-- Idempotent: only touches rows whose stored name still looks masked ('%***%')
-- and whose raw payload carries a real name. Safe to run more than once.

-- 1) Un-mask the owned candidate rows from their stored enrich payload.
update sourcing_external_candidates c
set
  full_name  = coalesce(nullif(trim(c.raw->>'name'), ''),
                         nullif(trim(concat_ws(' ', c.raw->>'first_name', c.raw->>'last_name')), ''),
                         c.full_name),
  first_name = coalesce(nullif(trim(c.raw->>'first_name'), ''), c.first_name),
  last_name  = coalesce(nullif(trim(c.raw->>'last_name'), ''),  c.last_name),
  updated_at = now()
where c.profile_unlocked = true
  and c.full_name like '%***%'
  and c.raw is not null
  and (c.raw ? 'name' or c.raw ? 'last_name');

-- 2) Propagate the now-real name onto existing campaign enrolments (they store
--    candidate_name as a copy, taken at enrol time). Match sourced enrolments to
--    their candidate by any revealed email address.
update enterprise_campaign_enrollments e
set candidate_name = c.full_name
from sourcing_external_candidates c
where c.org_id = e.org_id
  and e.candidate_source = 'sourcing'
  and e.candidate_name like '%***%'
  and c.full_name not like '%***%'
  and exists (
    select 1
    from jsonb_array_elements(c.emails) em
    where lower(em->>'value') = lower(e.candidate_email)
  );

-- 3) Same for talent-pool rows imported from sourcing.
update enterprise_talent_pool p
set candidate_name = c.full_name
from sourcing_external_candidates c
where c.org_id = p.org_id
  and p.candidate_name like '%***%'
  and c.full_name not like '%***%'
  and exists (
    select 1
    from jsonb_array_elements(c.emails) em
    where lower(em->>'value') = lower(p.candidate_email)
  );
