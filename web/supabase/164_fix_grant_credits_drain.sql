-- CRITICAL FIX: sourcing_grant_credits drained balances on every idempotent grant.
--
-- In plpgsql, a `begin … exception when X … end` block establishes a savepoint;
-- when the ledger INSERT raised unique_violation (a repeat monthly/trial grant),
-- Postgres AUTOMATICALLY rolled back the `balance = balance + p_amount` bump — and
-- then the exception handler subtracted p_amount AGAIN. Because ensureMonthlyGrant
-- / ensureTrialGrant run at the top of EVERY credit route, each call drained the
-- balance (e.g. −100 per call from the trial grant), so paid/granted credits
-- silently vanished. Recreate the function WITHOUT the manual rollback.
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
    -- Idempotent grant (period/trial already recorded). The failed INSERT already
    -- rolled the balance bump back via the block savepoint — DO NOT subtract again.
    select balance into v_balance from sourcing_credit_balances where org_id = p_org;
  end;
  return v_balance;
end $$;

-- Repair drained balances: the ledger is immutable and authoritative (the drain
-- never wrote ledger rows), so a balance = sum(ledger.amount) recompute restores
-- every org to its true balance.
update sourcing_credit_balances b
set balance = greatest(0, coalesce((select sum(l.amount) from sourcing_credit_ledger l where l.org_id = b.org_id), 0)),
    updated_at = now();
