-- 180_dashboard_access_override.sql
-- Grandfather paid-credit customers past the card-required trial gate.
-- The 2026-07-18 gate (#446) locked the dashboard behind an active/trialing
-- subscription — which also locked out customers who had BOUGHT credit packs
-- before the policy (found via Norbert's ticket 2026-07-20: "I have credits
-- but it demands a card"). Anyone who paid for credits, or was granted them
-- by support, is a paying customer and keeps dashboard access.

alter table user_billing
  add column if not exists dashboard_access_override boolean not null default false;

-- Backfill: everyone who ever purchased a top-up or received a support grant.
-- Upsert so credit holders with no user_billing row yet also get one.
insert into user_billing (user_id, plan, subscription_status, dashboard_access_override)
select distinct user_id, 'free', 'inactive', true
from token_ledger
where reason in ('topup', 'admin_credit')
on conflict (user_id) do update set dashboard_access_override = true;
