-- Outreach OS O1: per-org sending domains (Resend), mailbox registry with
-- honest ramp-up + health, bounce/complaint event log. No RLS (platform
-- convention): every query must filter org_id in app code.
--
-- Design notes:
-- * NO synthetic warm-up network. "Warm-up" here = a deterministic daily-limit
--   ramp per mailbox (start small, grow toward the cap) + bounce/complaint
--   thresholds that auto-pause. ToS-safe and explainable to operators.
-- * Cold outreach must NEVER go out from the shared jobsai.work domain —
--   sending identities are org-owned domains (verified via Resend) or the
--   recruiter's own connected Gmail/Microsoft mailbox.

create table if not exists sending_domains (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references enterprise_orgs(id) on delete cascade,
  domain            text not null,
  resend_domain_id  text,
  region            text,
  -- Resend statuses: not_started | pending | verified | partially_verified |
  -- partially_failed | failed (mirrored verbatim from the API)
  status            text not null default 'not_started',
  records           jsonb not null default '[]',   -- DNS records to configure, incl per-record status
  last_checked_at   timestamptz,
  verified_at       timestamptz,
  created_by        text not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (domain)                                   -- one org may claim a domain, globally
);
create index if not exists sending_domains_org_idx on sending_domains(org_id);

create table if not exists sending_mailboxes (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references enterprise_orgs(id) on delete cascade,
  kind             text not null check (kind in ('domain','gmail','microsoft')),
  address          text not null,
  display_name     text,
  domain_id        uuid references sending_domains(id) on delete cascade,  -- kind='domain' only
  status           text not null default 'active' check (status in ('active','paused')),
  paused_reason    text,          -- bounce_rate | complaint_rate | manual | domain_unverified
  paused_at        timestamptz,
  -- Ramp-up: effective daily limit grows from RAMP_START toward daily_limit_cap
  -- (computed in code from ramp_started_at — nothing to cron).
  ramp_started_at  timestamptz not null default now(),
  daily_limit_cap  int not null default 150,
  created_by       text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (org_id, address)
);
create index if not exists sending_mailboxes_org_idx on sending_mailboxes(org_id);

-- Per-mailbox daily counters — the source for ramp enforcement and health.
create table if not exists sending_mailbox_stats (
  mailbox_id  uuid not null references sending_mailboxes(id) on delete cascade,
  org_id      uuid not null references enterprise_orgs(id) on delete cascade,
  day         date not null,
  sends       int not null default 0,
  bounces     int not null default 0,
  complaints  int not null default 0,
  primary key (mailbox_id, day)
);
create index if not exists sending_mailbox_stats_org_idx on sending_mailbox_stats(org_id, day desc);

-- Raw bounce/complaint events from the Resend webhook (debugging + audit).
create table if not exists outreach_events (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references enterprise_orgs(id) on delete cascade,  -- null until mapped
  mailbox_id  uuid references sending_mailboxes(id) on delete set null,
  event       text not null,           -- email.bounced | email.complained | domain.updated | ...
  recipient   text,
  from_email  text,
  payload     jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists outreach_events_org_idx on outreach_events(org_id, created_at desc);

-- Atomic daily send counter: bumps today's row and returns the new count so
-- the send path can enforce the ramp limit without a read-modify-write race.
create or replace function sending_mailbox_record_send(p_mailbox uuid, p_org uuid)
returns int language plpgsql security definer as $$
declare v_sends int;
begin
  insert into sending_mailbox_stats (mailbox_id, org_id, day, sends)
    values (p_mailbox, p_org, current_date, 1)
    on conflict (mailbox_id, day) do update set sends = sending_mailbox_stats.sends + 1
    returning sends into v_sends;
  return v_sends;
end $$;
