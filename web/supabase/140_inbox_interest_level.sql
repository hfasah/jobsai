-- Graded interest labels on inbox threads (like Instantly's Medium/High/Very
-- High Interest). Complements the categorical `intent`: intent says WHAT the
-- reply is, interest says HOW WARM it is, so positive replies can be ranked by
-- how likely they are to convert. Score 0-100 with a derived bucket.
alter table inbox_threads
  add column if not exists interest_score numeric,   -- 0..100, null when not scored
  add column if not exists interest_level text
    check (interest_level in ('none', 'low', 'medium', 'high', 'very_high'));

create index if not exists inbox_threads_interest_idx
  on inbox_threads(org_id, interest_level);
