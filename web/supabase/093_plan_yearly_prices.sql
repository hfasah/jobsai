-- 093: Annual plan billing (20% off). Adds the yearly Stripe price id column and
-- seeds price_yearly. setup-enterprise-stripe.mjs then creates a yearly Stripe
-- price on each plan's existing product and writes the id back here. The webhook
-- maps either the monthly or yearly price → the plan.
alter table plans add column if not exists stripe_price_id_yearly text;

-- Annual totals = round(monthly × 0.8) × 12.
update plans set price_yearly = 2868  where slug = 'professional' and price_yearly is null;
update plans set price_yearly = 7668  where slug = 'agency'       and price_yearly is null;
update plans set price_yearly = 14388 where slug = 'business'     and price_yearly is null;

create index if not exists plans_stripe_price_yearly_idx on plans(stripe_price_id_yearly);
