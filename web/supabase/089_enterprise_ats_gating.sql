-- 089: Gate ATS integration (Merge) to Agency, Business, and Enterprise plans.
insert into features (feature_key, name, category, is_addon) values
  ('ats_integration', 'ATS Integration', 'Integrations', false)
on conflict (feature_key) do nothing;

-- Grant to Agency / Business / Enterprise (explicit — 083's cumulative
-- inheritance already ran before this feature existed).
insert into plan_features (plan_id, feature_id)
  select p.id, f.id
  from plans p
  join features f on f.feature_key = 'ats_integration'
  where p.slug in ('agency', 'business', 'enterprise')
on conflict do nothing;
