-- 183_platform_health.sql
-- Weekly platform health sweep (Mondays): each deploy's health cron runs
-- outcome checks ("did the work happen", not "did the cron run") and writes a
-- report + findings here; the admin portal Health page reads them and an alert
-- email goes out only when something is warn/critical. Born from the 2026-07
-- incident week: eight bugs ran silently behind green crons.

create table if not exists platform_health_reports (
  id          uuid primary key default gen_random_uuid(),
  platform    text not null check (platform in ('consumer', 'enterprise')),
  status      text not null check (status in ('ok', 'warn', 'critical')),
  summary     jsonb not null default '{}',   -- headline numbers for the report card
  created_at  timestamptz not null default now()
);

create table if not exists platform_health_findings (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references platform_health_reports(id) on delete cascade,
  severity    text not null check (severity in ('ok', 'warn', 'critical')),
  area        text not null,                 -- discovery | auto_apply | billing | email | stripe | campaigns | support | crons
  title       text not null,
  detail      text,
  metric      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists platform_health_reports_idx on platform_health_reports (platform, created_at desc);
create index if not exists platform_health_findings_report_idx on platform_health_findings (report_id);
