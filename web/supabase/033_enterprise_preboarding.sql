-- Pre-boarding: everything between offer-accepted and start date.
-- Reference checks + background checks + an onboarding hub that rolls it all up.

-- One onboarding record per candidate (created when moved to Offer/Hired)
create table if not exists enterprise_onboarding (
  id                 uuid primary key default gen_random_uuid(),
  application_id     uuid not null references enterprise_applications(id) on delete cascade,
  org_id             uuid not null,
  job_id             uuid not null,
  start_date         date,
  status             text not null default 'not_started',  -- not_started|in_progress|cleared|on_hold|completed
  offer_accepted_at  timestamptz,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique(application_id)
);

-- Reference checks
create table if not exists enterprise_references (
  id                uuid primary key default gen_random_uuid(),
  application_id    uuid not null references enterprise_applications(id) on delete cascade,
  job_id            uuid not null,
  org_id            uuid not null,
  referee_name      text not null,
  referee_email     text,
  referee_phone     text,
  relationship      text,                  -- Manager | Colleague | Direct report | Client | Other
  company           text,
  token             text not null unique default encode(gen_random_bytes(20), 'hex'),
  status            text not null default 'pending',  -- pending|sent|completed|declined
  questions         jsonb default '[]',    -- [{id, question}]
  responses         jsonb default '[]',    -- [{question, answer}]
  ai_summary        text,
  ai_sentiment      text,                  -- positive|mixed|negative
  ai_recommendation text,                  -- strong_yes|yes|maybe|no
  sent_at           timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz not null default now()
);

-- Background checks
create table if not exists enterprise_background_checks (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references enterprise_applications(id) on delete cascade,
  org_id          uuid not null,
  check_type      text not null,   -- identity|right_to_work|criminal|employment|education|credit|license|drug|reference
  label           text not null,
  status          text not null default 'pending',  -- pending|in_progress|clear|flagged|failed|na
  provider        text,
  reference_id    text,            -- provider case/order id
  notes           text,
  result_summary  text,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists ent_onboarding_app_idx on enterprise_onboarding(application_id);
create index if not exists ent_onboarding_org_idx on enterprise_onboarding(org_id);
create index if not exists ent_references_app_idx  on enterprise_references(application_id);
create index if not exists ent_references_token_idx on enterprise_references(token);
create index if not exists ent_bgchecks_app_idx    on enterprise_background_checks(application_id);
