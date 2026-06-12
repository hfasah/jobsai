-- 084: Stripe IDs on plans + add-on features (data-driven price → plan mapping)
-- The setup-enterprise-stripe.mjs script fills these in after creating Stripe
-- products/prices. The webhook maps a subscription price back to a plan/add-on
-- by looking up these columns — no env-var mapping needed.

alter table plans
  add column if not exists stripe_product_id text,
  add column if not exists stripe_price_id   text;   -- monthly recurring price

alter table features
  add column if not exists stripe_product_id text,
  add column if not exists stripe_price_id   text,
  add column if not exists price_monthly     numeric; -- add-on price (per month / per seat)

-- Per-seat add-on (Additional Recruiters +$29/user) — not a plan feature toggle,
-- tracked here so its Stripe price can be created/looked up like other add-ons.
insert into features (feature_key, name, category, is_addon, price_monthly) values
  ('extra_recruiter', 'Additional Recruiter', 'Add-on', true, 29)
on conflict (feature_key) do nothing;

-- Seed add-on list prices (for the script + the pricing UI later).
update features set price_monthly = 199 where feature_key = 'ai_interviews'    and price_monthly is null;
update features set price_monthly = 499 where feature_key = 'recruiting_agent'  and price_monthly is null;
update features set price_monthly = 99  where feature_key = 'sms_whatsapp'      and price_monthly is null;
update features set price_monthly = 199 where feature_key = 'white_label_plus'  and price_monthly is null;

create index if not exists plans_stripe_price_idx    on plans(stripe_price_id);
create index if not exists features_stripe_price_idx on features(stripe_price_id);
