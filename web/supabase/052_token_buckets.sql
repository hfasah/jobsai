-- Two-bucket token balance:
--   grant_balance  — monthly allowance, reset each month (use-it-or-lose-it)
--   topup_balance  — PURCHASED tokens, persist forever, never reset
-- The total spendable `balance` = grant_balance + topup_balance (kept in sync by
-- the app). Spends draw from the grant first, then top-ups.

alter table user_tokens add column if not exists grant_balance int not null default 0;
alter table user_tokens add column if not exists topup_balance int not null default 0;

-- Backfill: preserve everyone's current balance as PURCHASED (safe — a reset can
-- never wipe it). The next monthly grant refills grant_balance on top.
update user_tokens
set topup_balance = balance, grant_balance = 0
where grant_balance = 0 and topup_balance = 0 and balance > 0;
