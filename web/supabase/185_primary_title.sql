-- 185_primary_title.sql
-- A user's PRIMARY target title — the one Profile Search seeds first, so a
-- niche acronym that happens to sit first in job_titles isn't used by default.
-- Nullable; falls back to the first job title when unset.

alter table user_preferences
  add column if not exists primary_title text;
