-- Per-job resume override: when set, this job uses this resume version for
-- tailoring, ATS scans, cover letters, and auto-apply instead of the
-- auto-picked best match. Null = auto-pick (default behavior).
alter table jobs
  add column if not exists resume_version_id uuid references resume_versions (id) on delete set null;
