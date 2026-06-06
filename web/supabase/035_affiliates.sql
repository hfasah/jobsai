-- Affiliate program. Affiliates share a referral link; signups via the link get
-- 15% off their subscription, and the affiliate is credited.

create table if not exists affiliates (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  name             text not null,
  email            text,
  owner_user_id    text,            -- clerk user_id who owns this affiliate account
  discount_pct     int not null default 15,
  commission_pct   int not null default 20,   -- affiliate's cut of revenue (for reporting)
  clicks           int not null default 0,
  signups          int not null default 0,
  conversions      int not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists affiliate_referrals (
  id            uuid primary key default gen_random_uuid(),
  affiliate_id  uuid not null references affiliates(id) on delete cascade,
  ref_code      text not null,
  user_id       text,
  email         text,
  event         text not null default 'click',  -- click | signup | conversion
  plan          text,
  amount        numeric,
  created_at    timestamptz not null default now()
);

create index if not exists affiliates_code_idx        on affiliates(code);
create index if not exists affiliates_owner_idx        on affiliates(owner_user_id);
create index if not exists affiliate_referrals_aff_idx on affiliate_referrals(affiliate_id);
create index if not exists affiliate_referrals_evt_idx on affiliate_referrals(event);
