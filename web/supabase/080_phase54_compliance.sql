-- Phase 54: Compliance & Governance Center

-- GDPR / privacy request queue
create table if not exists enterprise_compliance_requests (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references enterprise_orgs(id) on delete cascade,
  request_type    text not null check (request_type in ('access', 'erasure', 'portability')),
  candidate_email text not null,
  candidate_name  text,
  status          text not null default 'pending'
                  check (status in ('pending', 'in_progress', 'completed', 'rejected')),
  notes           text,
  requested_at    timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     text,  -- Clerk user_id
  created_at      timestamptz not null default now()
);

create index if not exists enterprise_compliance_requests_org_idx
  on enterprise_compliance_requests(org_id, status);

-- Retention policy per org
alter table enterprise_orgs
  add column if not exists data_retention_days integer default null,      -- null = indefinite
  add column if not exists retention_action    text    default 'anonymize'
    check (retention_action in ('anonymize', 'delete'));

-- Legal hold on applications (prevents retention enforcement)
alter table enterprise_applications
  add column if not exists legal_hold        boolean not null default false,
  add column if not exists legal_hold_reason text;

create index if not exists enterprise_apps_legal_hold_idx
  on enterprise_applications(org_id, legal_hold) where legal_hold = true;
