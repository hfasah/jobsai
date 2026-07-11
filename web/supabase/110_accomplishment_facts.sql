-- Accomplishment facts — user-confirmed specifics surfaced by the resume intake
-- ("elicitation") interview. The tailoring AI is forbidden from inventing facts,
-- so a thin resume yields a thin result; this is where the real numbers/outcomes
-- the candidate confirms get stored. Kept RAW and keyed to an experience entry so
-- they ENRICH every future tailoring/build, not only the job that surfaced them.
--
-- Phase 1 = table only. It stays DORMANT: until the intake flow writes rows,
-- enrichProfile() finds nothing and returns the resume unchanged, so resume
-- generation behaves exactly as it does today. Safe to apply (or not) before any
-- UI ships — the app no-ops whether or not this table exists.

create table if not exists accomplishment_facts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                  -- Clerk user id
  -- Stable identity of the experience this fact belongs to:
  -- lower("company|title|start_date"). Survives resume re-parses/re-uploads.
  experience_key text not null,
  -- Which gap the answer fills: missing_metric|missing_outcome|
  -- missing_ownership|missing_scope. For analytics + follow-up logic.
  gap_type text,
  question text,                          -- the recruiter-style question asked
  answer text not null,                   -- the candidate's verbatim answer
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists accomplishment_facts_user_idx
  on accomplishment_facts(user_id);
create index if not exists accomplishment_facts_user_exp_idx
  on accomplishment_facts(user_id, experience_key);
