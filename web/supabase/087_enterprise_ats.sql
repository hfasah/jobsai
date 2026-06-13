-- 087: ATS integration via Merge.dev (unified ATS API).
create table if not exists enterprise_ats_connections (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references enterprise_orgs(id) on delete cascade,
  provider         text,            -- merge integration slug, e.g. 'greenhouse'
  integration_name text,            -- display name shown in the UI
  account_token    text not null,   -- Merge account token (account-scoped secret)
  status           text not null default 'active' check (status in ('active', 'disconnected')),
  last_synced_at   timestamptz,
  created_at       timestamptz not null default now(),
  unique (org_id)
);

-- Track the source ATS record so syncs upsert instead of duplicating.
alter table enterprise_jobs         add column if not exists ats_external_id text;
alter table enterprise_applications add column if not exists ats_external_id text;
create index if not exists enterprise_jobs_ats_idx on enterprise_jobs(org_id, ats_external_id);
create index if not exists enterprise_applications_ats_idx on enterprise_applications(org_id, ats_external_id);
