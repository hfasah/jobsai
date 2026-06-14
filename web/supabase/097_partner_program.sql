-- Partner (referral) program — Phase 2 foundation.
-- partner_accounts: a person/company who refers customers and earns commission.
-- partner_referrals: an org credited to a partner (one partner per org).
-- partner_commissions: per-invoice commission accruals, paid via Stripe Connect.

create table if not exists partner_accounts (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null unique,             -- Clerk user_id of the partner
  company_name      text,
  email             text,
  referral_code     text not null unique,             -- used in /partner/CODE and ?r=CODE
  tier              text not null default 'recruiting', -- recruiting | growth | strategic
  commission_rate   numeric not null default 20,      -- percent of collected revenue
  stripe_connect_id text,                             -- Stripe Connect (Express) account
  status            text not null default 'pending',  -- pending | active | suspended
  created_at        timestamptz not null default now()
);

create table if not exists partner_referrals (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references partner_accounts(id) on delete cascade,
  org_id         uuid references enterprise_orgs(id) on delete set null,
  referred_email text,
  status         text not null default 'pending',     -- pending | trial | active | cancelled
  created_at     timestamptz not null default now(),
  converted_at   timestamptz,
  unique(org_id)                                       -- one partner credit per org
);

create table if not exists partner_commissions (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references partner_accounts(id) on delete cascade,
  referral_id  uuid not null references partner_referrals(id) on delete cascade,
  invoice_id   text unique,                            -- Stripe invoice id (idempotency)
  amount_cents integer not null default 0,             -- commission amount in cents
  currency     text not null default 'usd',
  rate         numeric not null,                       -- rate applied (percent)
  status       text not null default 'pending',        -- pending | approved | paid | reversed
  available_at timestamptz,                            -- payable after the 30-day hold
  created_at   timestamptz not null default now(),
  paid_at      timestamptz
);

create index if not exists idx_partner_referrals_partner on partner_referrals(partner_id);
create index if not exists idx_partner_referrals_org on partner_referrals(org_id);
create index if not exists idx_partner_commissions_partner on partner_commissions(partner_id);
create index if not exists idx_partner_commissions_status on partner_commissions(status);
