-- Phase: Microsoft OAuth + Outbound Webhooks

-- OAuth accounts for enterprise recruiters (Microsoft, and future Google Calendar)
create table if not exists enterprise_oauth_accounts (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  provider     text not null check (provider in ('microsoft', 'google')),
  email        text,
  display_name text,
  access_token text not null,
  refresh_token text,
  expires_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (user_id, provider)
);

-- Outbound webhook endpoints per org
create table if not exists enterprise_webhooks (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references enterprise_orgs(id) on delete cascade,
  created_by          text not null,
  url                 text not null,
  secret              text not null,
  active              boolean not null default true,
  last_triggered_at   timestamptz,
  last_status         int,
  created_at          timestamptz not null default now()
);

create index if not exists enterprise_webhooks_org_idx on enterprise_webhooks(org_id);
