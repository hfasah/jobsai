-- Full Contact Unlock bundle (email + phone + profile URL) with progressive
-- pricing. Widen the three CHECK constraints so the new action/reason/type are
-- accepted. (Platform cost falls back to 6 in code; no cost-row seed needed.)
alter table sourcing_credit_ledger drop constraint if exists sourcing_credit_ledger_reason_check;
alter table sourcing_credit_ledger add constraint sourcing_credit_ledger_reason_check
  check (reason in (
    'monthly_grant','purchase','admin_adjustment','refund',
    'spend_search','spend_unlock_profile','spend_reveal_email','spend_reveal_phone',
    'spend_enrich','spend_full_contact_unlock'));

alter table sourcing_credit_costs drop constraint if exists sourcing_credit_costs_action_check;
alter table sourcing_credit_costs add constraint sourcing_credit_costs_action_check
  check (action in ('search','unlock_profile','reveal_email','reveal_phone','enrich','full_contact_unlock'));

alter table sourcing_reveals drop constraint if exists sourcing_reveals_reveal_type_check;
alter table sourcing_reveals add constraint sourcing_reveals_reveal_type_check
  check (reveal_type in ('profile','email','phone','enrich','full_contact_unlock'));
