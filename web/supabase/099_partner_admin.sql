-- Partner admin / Phase-1 manual payouts.
-- Registration fields collected on apply, payout details for manual payouts
-- (PayPal/Wise/bank), and a payout-batch table so "Mark paid" is auditable.

alter table partner_accounts add column if not exists website        text;
alter table partner_accounts add column if not exists audience_type   text;
alter table partner_accounts add column if not exists payout_method   text;   -- paypal | wise | bank | manual
alter table partner_accounts add column if not exists payout_email    text;
alter table partner_accounts add column if not exists payout_details  text;
alter table partner_accounts add column if not exists approved_at     timestamptz;

create table if not exists partner_payouts (
  id               uuid primary key default gen_random_uuid(),
  partner_id       uuid not null references partner_accounts(id) on delete cascade,
  amount_cents     integer not null,
  currency         text not null default 'usd',
  method           text,                 -- paypal | wise | bank | manual
  reference        text,                 -- external txn id / note
  commission_count integer not null default 0,
  created_at       timestamptz not null default now(),
  created_by       text                  -- admin Clerk user_id
);

-- Link each commission to the payout batch that settled it.
alter table partner_commissions add column if not exists payout_id uuid references partner_payouts(id) on delete set null;

create index if not exists idx_partner_payouts_partner on partner_payouts(partner_id);
