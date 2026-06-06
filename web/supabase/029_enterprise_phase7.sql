-- Phase 7: Enterprise Platform
-- ATS integrations, team management, audit logs, data controls

-- ATS + third-party integrations
create table if not exists enterprise_integrations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references enterprise_orgs(id) on delete cascade,
  provider    text not null,  -- greenhouse|lever|ashby|workday|bamboohr
  api_key     text,
  subdomain   text,           -- e.g. company.greenhouse.io → "company"
  config      jsonb default '{}',
  enabled     boolean default true,
  last_sync   timestamptz,
  created_at  timestamptz not null default now(),
  unique(org_id, provider)
);

-- Team member invitations
create table if not exists enterprise_invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references enterprise_orgs(id) on delete cascade,
  email       text not null,
  role        text not null default 'recruiter',
  token       text not null unique default encode(gen_random_bytes(16), 'hex'),
  invited_by  text not null,
  accepted_at timestamptz,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz not null default now()
);

-- Full audit log
create table if not exists enterprise_audit_logs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null,
  user_id       text,
  action        text not null,   -- job.created|candidate.moved|interview.sent|member.invited etc.
  resource_type text,            -- job|application|interview|member|integration
  resource_id   text,
  metadata      jsonb default '{}',
  ip_address    text,
  created_at    timestamptz not null default now()
);

-- Configurable email templates per org
create table if not exists enterprise_email_templates (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references enterprise_orgs(id) on delete cascade,
  trigger     text not null,  -- application_received|interview_invited|offer_sent|rejected
  subject     text not null,
  body        text not null,
  active      boolean default true,
  created_at  timestamptz not null default now(),
  unique(org_id, trigger)
);

-- Indexes
create index if not exists enterprise_integrations_org_idx on enterprise_integrations(org_id);
create index if not exists enterprise_invitations_token_idx on enterprise_invitations(token);
create index if not exists enterprise_invitations_email_idx on enterprise_invitations(email);
create index if not exists enterprise_audit_logs_org_idx    on enterprise_audit_logs(org_id);
create index if not exists enterprise_audit_logs_created_idx on enterprise_audit_logs(created_at desc);
create index if not exists enterprise_email_templates_org_idx on enterprise_email_templates(org_id);
