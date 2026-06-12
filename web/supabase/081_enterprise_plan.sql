-- Phase: Self-serve enterprise signup
alter table enterprise_orgs
  add column if not exists plan text not null default 'starter'
    check (plan in ('starter', 'growth', 'enterprise')),
  add column if not exists trial_ends_at timestamptz default null,
  add column if not exists stripe_customer_id text default null,
  add column if not exists stripe_subscription_id text default null;
