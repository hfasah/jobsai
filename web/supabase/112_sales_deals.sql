-- Lightweight sales pipeline (CRM) for the admin portal: deals with an owner,
-- a stage, an expected close date, and value. Optionally linked to an intake
-- lead. Accessed via the service role behind the admin guard.

create table if not exists sales_deals (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  company             text,
  contact_name        text,
  contact_email       text,
  owner               text,                          -- deal owner (rep name)
  stage               text not null default 'new',   -- new|qualified|demo|proposal|negotiation|won|lost
  value_cents         integer not null default 0,    -- deal size (annual contract value)
  probability         integer,                       -- 0-100 override; else stage default
  expected_close_date date,
  lead_id             uuid references enterprise_intake(id) on delete set null,
  notes               text,
  created_by          text,                          -- admin Clerk user id
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_sales_deals_stage on sales_deals(stage);
create index if not exists idx_sales_deals_owner on sales_deals(owner);
create index if not exists idx_sales_deals_close on sales_deals(expected_close_date);
