-- TalentSource entitlements: feature keys, plan attachments, monthly credit
-- allowances. Follows the 083 seeding conventions (slug lookups, on conflict
-- do nothing). global_sourcing/contact_reveal ship on Business+ plans and are
-- also purchasable as add-ons on lower tiers; company_lead_search is seeded
-- now but attached to nothing until Phase 2.

insert into features (feature_key, name, category, is_addon) values
  ('global_sourcing',     'Global Talent Sourcing',           'Sourcing', true),
  ('contact_reveal',      'Contact Reveal & Verification',    'Sourcing', true),
  ('company_lead_search', 'Company & Decision-Maker Leads',   'Sourcing', true)
on conflict (feature_key) do nothing;

-- Business gets Global Sourcing + Contact Reveal included…
insert into plan_features (plan_id, feature_id)
  select p.id, f.id from plans p join features f on f.feature_key in (
    'global_sourcing','contact_reveal'
  ) where p.slug = 'business'
on conflict do nothing;

-- …and Enterprise inherits them (add-on features are NOT auto-granted to the
-- enterprise plan by getOrgEntitlements, so attach explicitly).
insert into plan_features (plan_id, feature_id)
  select p.id, f.id from plans p join features f on f.feature_key in (
    'global_sourcing','contact_reveal'
  ) where p.slug = 'enterprise'
on conflict do nothing;

-- Monthly sourcing-credit allowance per plan (limit key read lazily by
-- ensureMonthlyGrant; 0 = no included credits, buy add-on/packs).
-- Conservative seeds — final numbers are a pricing decision.
insert into plan_limits (plan_id, limit_key, value)
  select id, 'sourcing_credits_monthly', 0    from plans where slug = 'professional' union all
  select id, 'sourcing_credits_monthly', 200  from plans where slug = 'agency'       union all
  select id, 'sourcing_credits_monthly', 1000 from plans where slug = 'business'     union all
  select id, 'sourcing_credits_monthly', 2500 from plans where slug = 'enterprise'
on conflict do nothing;
