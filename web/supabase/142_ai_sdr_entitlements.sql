-- AI SDR feature entitlement. Ships on Business+ plans and is purchasable as an
-- add-on on lower tiers. Follows 131's seeding conventions.
insert into features (feature_key, name, category, is_addon) values
  ('ai_sdr', 'AI SDR Auto-Reply', 'Outreach', true)
on conflict (feature_key) do nothing;

-- Business includes it…
insert into plan_features (plan_id, feature_id)
  select p.id, f.id from plans p join features f on f.feature_key = 'ai_sdr'
  where p.slug = 'business'
on conflict do nothing;

-- …and Enterprise inherits it explicitly (add-on features are NOT auto-granted
-- to the enterprise plan by getOrgEntitlements).
insert into plan_features (plan_id, feature_id)
  select p.id, f.id from plans p join features f on f.feature_key = 'ai_sdr'
  where p.slug = 'enterprise'
on conflict do nothing;
