-- 088: In-app cancellation + retention flow, and trial-abuse protection.
alter table enterprise_orgs
  add column if not exists cancel_at       timestamptz,   -- access ends here (cancel scheduled)
  add column if not exists cancel_reason   text,
  add column if not exists paused_until    timestamptz,   -- pause_collection resumes
  add column if not exists trial_extended  boolean not null default false,
  add column if not exists retention_offer text;          -- e.g. 'discount_50_6mo'

-- The "why are you leaving" data — gold for reducing churn.
create table if not exists enterprise_cancellation_feedback (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references enterprise_orgs(id) on delete cascade,
  user_id    text,
  reason     text,
  comment    text,
  outcome    text,  -- saved_discount | saved_pause | saved_extend | saved_demo | canceled
  created_at timestamptz not null default now()
);
create index if not exists cancellation_feedback_org_idx on enterprise_cancellation_feedback(org_id);

-- Trial-abuse protection: one trial per company domain / email / payment method.
create table if not exists enterprise_trial_usage (
  id                 uuid primary key default gen_random_uuid(),
  domain             text,
  email              text,
  stripe_customer_id text,
  org_id             uuid references enterprise_orgs(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index if not exists trial_usage_domain_idx on enterprise_trial_usage(lower(domain));
create index if not exists trial_usage_email_idx  on enterprise_trial_usage(lower(email));
