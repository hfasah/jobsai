-- Support tickets (contact form submissions)
create table if not exists support_tickets (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null,
  subject      text not null default '',
  message      text not null,
  category     text not null default 'general',
  status       text not null default 'open',
  admin_reply  text,
  replied_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists support_tickets_status_idx on support_tickets (status);
create index if not exists support_tickets_created_idx on support_tickets (created_at desc);

-- Job alert subscribers (no Clerk account needed)
create table if not exists job_alert_subscribers (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text,
  job_titles  text,
  locations   text,
  job_type    text not null default 'any',
  frequency   text not null default 'weekly',
  confirmed   boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists job_alert_subscribers_active_idx on job_alert_subscribers (active);
