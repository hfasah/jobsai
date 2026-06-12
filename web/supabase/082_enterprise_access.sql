-- Enterprise access gating (paywall + admin override)
-- New orgs start 'pending' (locked) until paid (Stripe) or comped by an admin.

alter table enterprise_orgs
  add column if not exists access_status text not null default 'pending'
    check (access_status in ('pending','active','comped','trialing','past_due','canceled')),
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text,
  add column if not exists activated_by           text,
  add column if not exists activated_at           timestamptz;

-- Grandfather every pre-existing org so current owners are NOT locked out.
update enterprise_orgs
  set access_status = 'active', activated_at = coalesce(activated_at, now())
  where access_status = 'pending' and created_at < now();

create index if not exists enterprise_orgs_access_status_idx on enterprise_orgs(access_status);
