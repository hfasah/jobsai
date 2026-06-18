-- Sales quotes built from the intake admin. An admin scopes a deal (plan,
-- add-ons, discounts) and emails the client a link to a hosted quote page.
-- Accessed via the service role; the public quote page reads by token.

create table if not exists enterprise_quotes (
  id                          uuid primary key default gen_random_uuid(),
  token                       text not null unique,          -- public quote page
  lead_id                     uuid references enterprise_intake(id) on delete set null,
  -- Snapshot of who the quote is for (so it survives lead edits/deletes).
  company                     text,
  contact_name                text,
  contact_email               text,
  -- Selection.
  plan_slug                   text not null,
  billing_period              text not null default 'yearly',  -- monthly | yearly
  addons                      jsonb not null default '[]'::jsonb, -- [{feature_key, quantity}]
  extra_recruiters            integer not null default 0,
  -- Pricing knobs.
  discount_pct                numeric not null default 0,        -- custom discount %
  founding                    boolean not null default false,    -- 50% off first year
  price_override_monthly_cents integer,                          -- manual final monthly price
  -- Snapshot totals (cents) computed server-side at save time.
  monthly_cents               integer not null default 0,
  yearly_cents                integer not null default 0,
  first_year_cents            integer not null default 0,
  -- Meta.
  notes                       text,
  status                      text not null default 'draft',     -- draft | sent | accepted | expired
  created_by                  text,                              -- admin Clerk user id
  sent_at                     timestamptz,
  accepted_at                 timestamptz,
  created_at                  timestamptz not null default now()
);

create index if not exists idx_enterprise_quotes_lead on enterprise_quotes(lead_id);
create index if not exists idx_enterprise_quotes_token on enterprise_quotes(token);
create index if not exists idx_enterprise_quotes_status on enterprise_quotes(status);
