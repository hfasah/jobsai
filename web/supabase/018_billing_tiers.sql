-- Phase 39 — expand plan tiers from free/pro/business to free/pro/premium/accelerator

alter table user_billing drop constraint if exists user_billing_plan_check;

-- Remap any legacy 'business' subscribers to the closest new tier.
update user_billing set plan = 'premium' where plan = 'business';

alter table user_billing add constraint user_billing_plan_check
  check (plan in ('free', 'pro', 'premium', 'accelerator'));
