-- 083: Enterprise plan entitlement system
-- Data-driven plans → features / limits, plus per-org add-ons and overrides.
-- Replaces the hardcoded 081 plan enum with a plans table + plan_id FK.

-- ── Catalog tables ──────────────────────────────────────────────
create table if not exists plans (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  price_monthly numeric,            -- null = custom (Enterprise)
  price_yearly  numeric,
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists features (
  id          uuid primary key default gen_random_uuid(),
  feature_key text not null unique,
  name        text not null,
  category    text,
  is_addon    boolean not null default false,   -- sold separately, never in plan_features
  created_at  timestamptz not null default now()
);

create table if not exists plan_features (
  plan_id    uuid not null references plans(id) on delete cascade,
  feature_id uuid not null references features(id) on delete cascade,
  primary key (plan_id, feature_id)
);

create table if not exists plan_limits (
  plan_id   uuid not null references plans(id) on delete cascade,
  limit_key text not null,           -- recruiters | jobs | candidates
  value     int  not null,           -- -1 = unlimited
  primary key (plan_id, limit_key)
);

create table if not exists org_addons (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references enterprise_orgs(id) on delete cascade,
  addon_key   text not null,         -- a feature_key the add-on grants
  status      text not null default 'active' check (status in ('active','canceled')),
  stripe_subscription_item_id text,
  created_at  timestamptz not null default now(),
  unique (org_id, addon_key)
);

create table if not exists org_feature_overrides (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references enterprise_orgs(id) on delete cascade,
  feature_key text not null,
  enabled     boolean not null default true,   -- false = explicitly deny
  note        text,
  created_by  text,
  created_at  timestamptz not null default now(),
  unique (org_id, feature_key)
);

-- ── Wire plan onto orgs (replace the old hardcoded 081 plan enum) ──
alter table enterprise_orgs drop column if exists plan;        -- also drops its check constraint
alter table enterprise_orgs add column if not exists plan_id uuid references plans(id);

-- ── Seed: plans ─────────────────────────────────────────────────
insert into plans (slug, name, price_monthly, sort_order) values
  ('professional', 'Professional', 299,  1),
  ('agency',       'Agency',       799,  2),
  ('business',     'Business',     1499, 3),
  ('enterprise',   'Enterprise',   null, 4)
on conflict (slug) do nothing;

-- ── Seed: features ──────────────────────────────────────────────
insert into features (feature_key, name, category, is_addon) values
  -- Recruiting Core (Professional)
  ('ats',                     'ATS',                       'Recruiting Core', false),
  ('candidate_database',      'Candidate Database',        'Recruiting Core', false),
  ('career_pages',            'Career Pages',              'Recruiting Core', false),
  ('candidate_portal',        'Candidate Portal',          'Recruiting Core', false),
  ('job_posting',             'Job Posting',               'Recruiting Core', false),
  ('resume_parsing',          'Resume Parsing',            'Recruiting Core', false),
  ('ai_scoring',              'AI Candidate Scoring',      'AI',              false),
  ('ai_top_picks',            'AI Top Picks',              'AI',              false),
  ('ai_comparison',           'AI Candidate Comparison',   'AI',              false),
  ('scheduling_google',       'Google Calendar',           'Scheduling',      false),
  ('scheduling_outlook',      'Outlook Calendar',          'Scheduling',      false),
  ('self_service_scheduling', 'Self-Service Scheduling',   'Scheduling',      false),
  ('offers',                  'Offer Letters',             'Hiring',          false),
  ('e_signature',             'E-Signature',               'Hiring',          false),
  -- Agency
  ('crm',                     'Recruiting CRM',            'CRM',             false),
  ('talent_pools',            'Talent Pools',              'CRM',             false),
  ('candidate_nurturing',     'Candidate Nurturing',       'CRM',             false),
  ('outreach_campaigns',      'Outreach Campaigns',        'CRM',             false),
  ('ai_sourcing',             'AI Sourcing',               'Sourcing',        false),
  ('talent_rediscovery',      'Talent Rediscovery',        'Sourcing',        false),
  ('candidate_recommendations','Candidate Recommendations','Sourcing',        false),
  ('client_portal',           'Client Portal',             'Client',          false),
  ('candidate_sharing',       'Candidate Sharing',         'Client',          false),
  ('client_reporting',        'Client Reporting',          'Client',          false),
  ('white_label',             'White Label',               'Branding',        false),
  ('custom_domain',           'Custom Domain',             'Branding',        false),
  -- Business
  ('sso',                     'SAML / SSO',                'Enterprise',      false),
  ('hiring_manager_workspace','Hiring Manager Workspace',  'Enterprise',      false),
  ('workflow_automation',     'Workflow Automation',       'Enterprise',      false),
  ('executive_analytics',     'Executive Analytics',       'Intelligence',    false),
  ('funnel_reporting',        'Funnel Reporting',          'Intelligence',    false),
  ('productivity_metrics',    'Recruiter Productivity Metrics','Intelligence',false),
  ('compliance_gdpr',         'GDPR',                      'Compliance',      false),
  ('retention_policies',      'Retention Policies',        'Compliance',      false),
  ('audit_logs',              'Audit Logs',                'Compliance',      false),
  ('legal_hold',              'Legal Hold',                'Compliance',      false),
  -- Enterprise (Plan 4)
  ('dedicated_support',       'Dedicated Support',         'Enterprise+',     false),
  ('sla',                     'SLA',                       'Enterprise+',     false),
  ('custom_integrations',     'Custom Integrations',       'Enterprise+',     false),
  ('workday_integration',     'Workday Integration',       'Enterprise+',     false),
  ('adp_integration',         'ADP Integration',           'Enterprise+',     false),
  ('private_onboarding',      'Private Onboarding',        'Enterprise+',     false),
  ('security_reviews',        'Security Reviews',          'Enterprise+',     false),
  ('custom_ai_workflows',     'Custom AI Workflows',       'Enterprise+',     false),
  -- Add-ons (sold separately, granted via org_addons)
  ('ai_interviews',           'AI Interview Suite',        'Add-on',          true),
  ('recruiting_agent',        'Autonomous Recruiting Agent','Add-on',         true),
  ('sms_whatsapp',            'SMS & WhatsApp',            'Add-on',          true),
  ('white_label_plus',        'White Label Plus',          'Add-on',          true)
on conflict (feature_key) do nothing;

-- ── Seed: plan_features (cumulative via inherit-from-lower-tier) ──
-- Professional: its own features
insert into plan_features (plan_id, feature_id)
  select p.id, f.id from plans p join features f on f.feature_key in (
    'ats','candidate_database','career_pages','candidate_portal','job_posting','resume_parsing',
    'ai_scoring','ai_top_picks','ai_comparison',
    'scheduling_google','scheduling_outlook','self_service_scheduling',
    'offers','e_signature'
  ) where p.slug = 'professional'
on conflict do nothing;

-- Agency: its new features…
insert into plan_features (plan_id, feature_id)
  select p.id, f.id from plans p join features f on f.feature_key in (
    'crm','talent_pools','candidate_nurturing','outreach_campaigns',
    'ai_sourcing','talent_rediscovery','candidate_recommendations',
    'client_portal','candidate_sharing','client_reporting',
    'white_label','custom_domain'
  ) where p.slug = 'agency'
on conflict do nothing;
-- …plus everything in Professional
insert into plan_features (plan_id, feature_id)
  select (select id from plans where slug='agency'), feature_id
  from plan_features where plan_id = (select id from plans where slug='professional')
on conflict do nothing;

-- Business: its new features…
insert into plan_features (plan_id, feature_id)
  select p.id, f.id from plans p join features f on f.feature_key in (
    'sso','hiring_manager_workspace','workflow_automation',
    'executive_analytics','funnel_reporting','productivity_metrics',
    'compliance_gdpr','retention_policies','audit_logs','legal_hold'
  ) where p.slug = 'business'
on conflict do nothing;
-- …plus everything in Agency
insert into plan_features (plan_id, feature_id)
  select (select id from plans where slug='business'), feature_id
  from plan_features where plan_id = (select id from plans where slug='agency')
on conflict do nothing;

-- Enterprise: its new features…
insert into plan_features (plan_id, feature_id)
  select p.id, f.id from plans p join features f on f.feature_key in (
    'dedicated_support','sla','custom_integrations','workday_integration',
    'adp_integration','private_onboarding','security_reviews','custom_ai_workflows'
  ) where p.slug = 'enterprise'
on conflict do nothing;
-- …plus everything in Business
insert into plan_features (plan_id, feature_id)
  select (select id from plans where slug='enterprise'), feature_id
  from plan_features where plan_id = (select id from plans where slug='business')
on conflict do nothing;

-- ── Seed: plan_limits (-1 = unlimited) ──────────────────────────
insert into plan_limits (plan_id, limit_key, value)
  select id, 'recruiters', 3     from plans where slug='professional' union all
  select id, 'jobs',       10    from plans where slug='professional' union all
  select id, 'candidates', 5000  from plans where slug='professional' union all
  select id, 'recruiters', 10    from plans where slug='agency'       union all
  select id, 'jobs',       50    from plans where slug='agency'       union all
  select id, 'candidates', 50000 from plans where slug='agency'       union all
  select id, 'recruiters', 25    from plans where slug='business'     union all
  select id, 'jobs',       -1    from plans where slug='business'     union all
  select id, 'candidates', -1    from plans where slug='business'     union all
  select id, 'recruiters', -1    from plans where slug='enterprise'   union all
  select id, 'jobs',       -1    from plans where slug='enterprise'   union all
  select id, 'candidates', -1    from plans where slug='enterprise'
on conflict do nothing;

-- ── Backfill: grandfather existing orgs onto the Enterprise plan ──
update enterprise_orgs
  set plan_id = (select id from plans where slug = 'enterprise')
  where plan_id is null;

create index if not exists org_addons_org_idx            on org_addons(org_id);
create index if not exists org_feature_overrides_org_idx on org_feature_overrides(org_id);
