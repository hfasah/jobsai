-- TalentSource polish: credit-pack purchase idempotency + per-org daily
-- spend cap.

-- Credit purchases reuse the ledger's `period` column to carry the Stripe
-- checkout-session id; this partial unique index makes webhook retries a
-- no-op (sourcing_grant_credits already catches unique_violation and rolls
-- back the balance bump — same mechanism as the monthly grant).
create unique index if not exists sourcing_purchase_once
  on sourcing_credit_ledger(org_id, period) where reason = 'purchase';

-- Optional per-org daily credit spend cap (cost control against runaway
-- provider bills). NULL = no cap.
alter table sourcing_org_settings
  add column if not exists daily_credit_limit int;
