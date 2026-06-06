-- Replace fixed US/Canada work auth columns with flexible multi-country JSONB.
-- Add a languages JSONB column for proficiency tracking.
-- [{country: "United States", status: "Citizen"}, ...]
-- [{language: "French", proficiency: "Fluent (C1-C2)"}, ...]

alter table apply_profiles
  add column if not exists work_auth_countries jsonb default '[]',
  add column if not exists languages           jsonb default '[]';
