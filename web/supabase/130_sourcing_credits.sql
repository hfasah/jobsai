-- TalentSource credit system — org-scoped, append-only ledger + materialized
-- balance updated atomically via SQL functions so concurrent reveals can never
-- overdraw. Costs are configurable: one platform-default row set (org_id null)
-- overlaid by optional per-org overrides. Monthly allowance comes from
-- plan_limits key 'sourcing_credits_monthly' and is granted LAZILY from route
-- code (idempotent per period via the partial unique index below) — no cron.

create table if not exists sourcing_credit_balances (
  org_id     uuid primary key references enterprise_orgs(id) on delete cascade,
  balance    int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists sourcing_credit_ledger (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references enterprise_orgs(id) on delete cascade,
  amount        int not null,          -- + grant/refund, - spend
  balance_after int not null,
  reason        text not null check (reason in
    ('monthly_grant','purchase','admin_adjustment','refund',
     'spend_search','spend_unlock_profile','spend_reveal_email','spend_reveal_phone','spend_enrich')),
  period        text,                  -- 'YYYY-MM', set only on monthly_grant (idempotency key)
  ref_type      text,                  -- 'run' | 'reveal'
  ref_id        uuid,
  created_by    text,
  metadata      jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists sourcing_credit_ledger_org_idx on sourcing_credit_ledger(org_id, created_at desc);
create unique index if not exists sourcing_monthly_grant_once
  on sourcing_credit_ledger(org_id, period) where reason = 'monthly_grant';

create table if not exists sourcing_credit_costs (
  id      uuid primary key default gen_random_uuid(),
  org_id  uuid references enterprise_orgs(id) on delete cascade,  -- null = platform default
  action  text not null check (action in ('search','unlock_profile','reveal_email','reveal_phone','enrich')),
  cost    int not null check (cost >= 0)
);
create unique index if not exists sourcing_credit_costs_uniq
  on sourcing_credit_costs(coalesce(org_id, '00000000-0000-0000-0000-000000000000'::uuid), action);

insert into sourcing_credit_costs (org_id, action, cost) values
  (null, 'search',         1),
  (null, 'unlock_profile', 1),
  (null, 'reveal_email',   2),
  (null, 'reveal_phone',   5),
  (null, 'enrich',         3)
on conflict do nothing;

-- Atomic spend. Returns ok=false (and the current balance) when insufficient —
-- the conditional single-statement UPDATE is the concurrency guard.
create or replace function sourcing_spend_credits(
  p_org uuid, p_amount int, p_reason text, p_ref_type text, p_ref_id uuid, p_user text
) returns table (ok boolean, balance int, ledger_id uuid)
language plpgsql security definer as $$
declare
  v_balance int;
  v_ledger  uuid;
begin
  insert into sourcing_credit_balances(org_id, balance) values (p_org, 0)
    on conflict (org_id) do nothing;
  update sourcing_credit_balances b
    set balance = b.balance - p_amount, updated_at = now()
    where b.org_id = p_org and b.balance >= p_amount
    returning b.balance into v_balance;
  if not found then
    select b.balance into v_balance from sourcing_credit_balances b where b.org_id = p_org;
    return query select false, coalesce(v_balance, 0), null::uuid;
    return;
  end if;
  insert into sourcing_credit_ledger(org_id, amount, balance_after, reason, ref_type, ref_id, created_by)
    values (p_org, -p_amount, v_balance, p_reason, p_ref_type, p_ref_id, p_user)
    returning id into v_ledger;
  return query select true, v_balance, v_ledger;
end $$;

-- Grant / refund. For monthly grants pass p_period ('YYYY-MM'); the partial
-- unique index makes a repeat grant a no-op (balance bump is rolled back).
create or replace function sourcing_grant_credits(
  p_org uuid, p_amount int, p_reason text, p_period text, p_ref_type text, p_ref_id uuid, p_user text
) returns int
language plpgsql security definer as $$
declare v_balance int;
begin
  insert into sourcing_credit_balances(org_id, balance) values (p_org, 0)
    on conflict (org_id) do nothing;
  begin
    update sourcing_credit_balances set balance = balance + p_amount, updated_at = now()
      where org_id = p_org returning balance into v_balance;
    insert into sourcing_credit_ledger(org_id, amount, balance_after, reason, period, ref_type, ref_id, created_by)
      values (p_org, p_amount, v_balance, p_reason, p_period, p_ref_type, p_ref_id, p_user);
  exception when unique_violation then
    update sourcing_credit_balances set balance = balance - p_amount, updated_at = now()
      where org_id = p_org;
    select balance into v_balance from sourcing_credit_balances where org_id = p_org;
  end;
  return v_balance;
end $$;

-- Reveal rows point at the ledger entry that paid for them (column from 129).
alter table sourcing_reveals
  drop constraint if exists sourcing_reveals_ledger_fk;
alter table sourcing_reveals
  add constraint sourcing_reveals_ledger_fk
  foreign key (ledger_entry_id) references sourcing_credit_ledger(id);
