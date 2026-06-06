-- Bring-your-own-credentials job board connections. Partners/clients plug in
-- their own API credentials and/or feed URLs to POST jobs to, or PULL jobs from,
-- any third-party board — however they see fit.

create table if not exists enterprise_board_credentials (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null,
  board          text not null,                 -- indeed|ziprecruiter|linkedin|monster|custom...
  label          text,
  direction      text not null default 'post',  -- post | pull | both
  api_key        text,
  api_secret     text,
  account_id     text,                           -- publisher / account / partner id
  feed_url       text,                           -- for pulling: the board's job feed
  config         jsonb default '{}',
  enabled        boolean not null default true,
  last_sync      timestamptz,
  jobs_imported  int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists ent_board_creds_org_idx on enterprise_board_credentials(org_id);
