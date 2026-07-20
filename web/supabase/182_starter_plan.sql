-- 182_starter_plan.sql
-- New self-serve Starter tier ($99/mo, $79/mo billed annually) for independent
-- recruiters & boutique agencies (market/design team spec, 2026-07-20).
-- Ladder: Starter 99 → Professional 299 → Agency 799 → Business 1499 → Enterprise.
--
-- NOTE on CRM: the spec gives Starter the base Recruiting CRM + Talent Pools.
-- To keep the ladder monotonic ("everything in Starter" must hold upward),
-- Professional also gains crm + talent_pools here. Agency keeps its
-- differentiators (nurturing, outreach, automation, client portal, white label).

-- ── Plan row ────────────────────────────────────────────────────
insert into plans (slug, name, price_monthly, price_yearly, sort_order) values
  ('starter', 'Starter', 99, 948, 0)
on conflict (slug) do nothing;

-- ── Starter features ────────────────────────────────────────────
-- ATS core + base CRM + AI essentials (scoring, top picks) + scheduling +
-- offers. Deliberately excluded (upgrade reasons): ai_comparison, ai_sourcing,
-- outreach_campaigns, candidate_nurturing, client_portal, white_label, and all
-- Business/Enterprise features. AI Interview Suite / Recruiting Agent /
-- SMS & WhatsApp stay purchasable as add-ons (org_addons).
insert into plan_features (plan_id, feature_id)
  select p.id, f.id from plans p join features f on f.feature_key in (
    'ats','candidate_database','career_pages','candidate_portal','job_posting','resume_parsing',
    'ai_scoring','ai_top_picks',
    'scheduling_google','scheduling_outlook','self_service_scheduling',
    'offers','e_signature',
    'crm','talent_pools'
  ) where p.slug = 'starter'
on conflict do nothing;

-- ── Ladder coherence: Professional gains base CRM + Talent Pools ─
insert into plan_features (plan_id, feature_id)
  select p.id, f.id from plans p join features f on f.feature_key in ('crm','talent_pools')
  where p.slug = 'professional'
on conflict do nothing;

-- ── Starter limits ──────────────────────────────────────────────
insert into plan_limits (plan_id, limit_key, value)
  select id, 'recruiters', 1    from plans where slug='starter' union all
  select id, 'jobs',       10   from plans where slug='starter' union all
  select id, 'candidates', 2000 from plans where slug='starter'
on conflict do nothing;
