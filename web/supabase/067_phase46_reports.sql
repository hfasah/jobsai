-- Phase 46: Analytics & Client Reporting
-- enterprise_report_shares: shareable public report tokens
-- enterprise_report_schedules: recurring email delivery

create table if not exists enterprise_report_shares (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references enterprise_orgs(id) on delete cascade,
  created_by  text not null,
  token       text not null unique,
  label       text not null,
  filters     jsonb not null default '{}'::jsonb,
  expires_at  timestamptz,
  view_count  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists enterprise_report_shares_org_idx on enterprise_report_shares(org_id);
create index if not exists enterprise_report_shares_token_idx on enterprise_report_shares(token);

create table if not exists enterprise_report_schedules (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references enterprise_orgs(id) on delete cascade,
  created_by    text not null,
  label         text not null,
  recipients    text[] not null,
  frequency     text not null check (frequency in ('weekly','monthly')),
  day_of_week   int not null default 1,
  filters       jsonb not null default '{}'::jsonb,
  active        boolean not null default true,
  next_send_at  timestamptz,
  last_sent_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists enterprise_report_schedules_org_idx on enterprise_report_schedules(org_id);
create index if not exists enterprise_report_schedules_next_send_idx on enterprise_report_schedules(next_send_at) where active = true;
