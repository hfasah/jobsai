-- Monetization: free search + preview; pay only to reveal a verified contact.
-- Fixes "users can't pay for something they don't see" — a 0-balance org can
-- now search and SEE real leads, and only spends credits on reveal/enrich.
-- Plus a one-time free-trial grant so they can experience a reveal before paying.

-- Search and profile-unlock become free (platform defaults). Reveal
-- email/phone and full enrichment stay paid.
update sourcing_credit_costs set cost = 0
  where org_id is null and action in ('search', 'unlock_profile');

-- Free trial credits (granted once per org, idempotent via the index below).
alter table sourcing_credit_ledger drop constraint if exists sourcing_credit_ledger_reason_check;
alter table sourcing_credit_ledger add constraint sourcing_credit_ledger_reason_check
  check (reason in (
    'monthly_grant', 'purchase', 'admin_adjustment', 'refund', 'trial_grant',
    'spend_search', 'spend_unlock_profile', 'spend_reveal_email', 'spend_reveal_phone', 'spend_enrich'));

create unique index if not exists sourcing_trial_grant_once
  on sourcing_credit_ledger(org_id) where reason = 'trial_grant';
