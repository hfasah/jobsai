-- Phase 17: Billing & plan management

create table if not exists user_billing (
  user_id              text primary key,
  plan                 text not null default 'free'
                         check (plan in ('free', 'pro', 'business')),
  stripe_customer_id   text unique,
  stripe_subscription_id text unique,
  subscription_status  text not null default 'inactive',
  current_period_end   timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists user_billing_stripe_customer_idx
  on user_billing (stripe_customer_id);

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger user_billing_updated_at
  before update on user_billing
  for each row execute function set_updated_at();
