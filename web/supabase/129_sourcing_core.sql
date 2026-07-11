-- TalentSource ("Global Sourcing") core schema — Phase 1.
-- External candidate search across licensed data providers, org-scoped result
-- cache with full provenance, saved searches, runs, reveals, suppression and
-- import tracking. No RLS (matches the rest of the enterprise schema): every
-- query MUST filter by org_id in application code via supabaseAdmin.

-- ── Provider enablement / config per org ─────────────────────────
-- Platform-level API keys live in env (PDL_API_KEY etc.); a row here may carry
-- a per-org key override. api_key is plaintext per the existing
-- enterprise_integrations convention (service-role only, masked in responses;
-- encrypt at rest in a hardening pass).
create table if not exists sourcing_providers (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references enterprise_orgs(id) on delete cascade,
  provider_key  text not null check (provider_key in ('mock','pdl')),
  enabled       boolean not null default true,
  api_key       text,
  settings      jsonb not null default '{}',
  created_by    text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, provider_key)
);
create index if not exists sourcing_providers_org_idx on sourcing_providers(org_id);

-- ── Saved searches ───────────────────────────────────────────────
-- schedule jsonb is reserved for Phase-2 recurring searches + alerts.
create table if not exists sourcing_searches (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references enterprise_orgs(id) on delete cascade,
  created_by  text not null,
  name        text not null,
  query_text  text,
  filters     jsonb not null default '{}',
  mode        text not null default 'external' check (mode in ('external','internal','combined')),
  weights     jsonb,
  visibility  text not null default 'private' check (visibility in ('private','shared')),
  schedule    jsonb,
  last_run_at timestamptz,
  run_count   int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists sourcing_searches_org_idx on sourcing_searches(org_id);

-- ── One row per executed search ──────────────────────────────────
create table if not exists sourcing_search_runs (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references enterprise_orgs(id) on delete cascade,
  search_id       uuid references sourcing_searches(id) on delete set null,
  created_by      text not null,
  mode            text not null check (mode in ('external','internal','combined')),
  query_text      text,
  filters         jsonb not null default '{}',
  weights         jsonb not null default '{}',
  providers       text[] not null default '{}',
  status          text not null default 'running' check (status in ('running','completed','partial','failed')),
  result_count    int not null default 0,
  external_count  int not null default 0,
  internal_count  int not null default 0,
  credits_charged int not null default 0,
  error           text,
  duration_ms     int,
  created_at      timestamptz not null default now()
);
create index if not exists sourcing_search_runs_org_idx on sourcing_search_runs(org_id, created_at desc);

-- ── External candidate cache (the compliance record) ─────────────
-- Kept separate from enterprise_applications / enterprise_talent_pool on
-- purpose: provenance + licensing metadata stays here, and entering the ATS is
-- an explicit, permission-gated import step (sourcing_imports below).
create table if not exists sourcing_external_candidates (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references enterprise_orgs(id) on delete cascade,
  provider_key        text not null,
  provider_record_id  text not null,
  source_type         text not null default 'provider_api',
  permitted_use       text,
  collected_at        timestamptz not null default now(),
  confidence          numeric,
  full_name           text,
  first_name          text,
  last_name           text,
  job_title           text,
  company             text,
  location_country    text,
  location_locality   text,
  skills              text[] not null default '{}',
  experience_years    numeric,
  industries          text[] not null default '{}',
  education           jsonb not null default '[]',
  languages           text[] not null default '{}',
  linkedin_url        text,
  github_url          text,
  portfolio_url       text,
  -- availability signals shown pre-reveal; values arrive only after a reveal
  has_email           boolean,
  has_phone           boolean,
  emails              jsonb not null default '[]',  -- [{value,type,verified,verification_status,revealed_at}]
  phones              jsonb not null default '[]',
  profile_unlocked    boolean not null default false,
  enriched_at         timestamptz,
  raw                 jsonb,                         -- cached provider enrich payload (trimmed)
  suppressed          boolean not null default false,
  bad_data_reported   boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (org_id, provider_key, provider_record_id)
);
create index if not exists sourcing_ext_cand_org_idx on sourcing_external_candidates(org_id);
create index if not exists sourcing_ext_cand_linkedin_idx on sourcing_external_candidates(org_id, linkedin_url);

-- ── Run results (external OR internal rows, scored + deduped) ────
create table if not exists sourcing_run_results (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references enterprise_orgs(id) on delete cascade,
  run_id                 uuid not null references sourcing_search_runs(id) on delete cascade,
  origin                 text not null check (origin in ('external','internal_application','internal_pool')),
  external_candidate_id  uuid references sourcing_external_candidates(id) on delete cascade,
  internal_ref_id        uuid,   -- enterprise_applications.id or enterprise_talent_pool.id
  match_score            int,
  score_breakdown        jsonb,  -- {skills:{score,weight,matched:[],missing:[]}, title:{...}, ...}
  fit_reason             text,   -- LLM one-liner, filled lazily via after()
  dedup_status           text not null default 'new'
    check (dedup_status in ('new','possible_duplicate','existing','imported','previously_contacted')),
  dedup_matches          jsonb,  -- [{type:'application'|'talent_pool'|'import', id, matched_on}]
  not_relevant           boolean not null default false,
  position               int,
  created_at             timestamptz not null default now()
);
create index if not exists sourcing_run_results_run_idx on sourcing_run_results(run_id, position);
create index if not exists sourcing_run_results_org_idx on sourcing_run_results(org_id);

-- ── Reveal / unlock / enrich log (auditable spend record) ────────
-- ledger_entry_id gains its FK in 130 (ledger table created there).
create table if not exists sourcing_reveals (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references enterprise_orgs(id) on delete cascade,
  external_candidate_id  uuid not null references sourcing_external_candidates(id) on delete cascade,
  revealed_by            text not null,
  reveal_type            text not null check (reveal_type in ('profile','email','phone','enrich')),
  provider_key           text not null,
  credits_spent          int not null default 0,
  ledger_entry_id        uuid,
  status                 text not null default 'success' check (status in ('success','failed','refunded','no_data')),
  result                 jsonb,
  created_at             timestamptz not null default now()
);
create index if not exists sourcing_reveals_org_idx on sourcing_reveals(org_id, created_at desc);

-- ── Suppression list (do-not-source) ─────────────────────────────
create table if not exists sourcing_suppressions (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references enterprise_orgs(id) on delete cascade,
  email               text,
  linkedin_url        text,
  provider_key        text,
  provider_record_id  text,
  full_name           text,
  reason              text not null default 'user_suppressed'
    check (reason in ('user_suppressed','do_not_contact','bad_data','erasure_request')),
  created_by          text not null,
  created_at          timestamptz not null default now()
);
create index if not exists sourcing_suppressions_email_idx on sourcing_suppressions(org_id, lower(email));
create index if not exists sourcing_suppressions_linkedin_idx on sourcing_suppressions(org_id, linkedin_url);

-- ── Import provenance ────────────────────────────────────────────
create table if not exists sourcing_imports (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references enterprise_orgs(id) on delete cascade,
  external_candidate_id  uuid not null references sourcing_external_candidates(id) on delete cascade,
  imported_by            text not null,
  target_type            text not null check (target_type in ('talent_pool','job','intake')),
  job_id                 uuid,
  application_id         uuid,
  talent_pool_id         uuid,
  pool_group_id          uuid,
  dedup_status           text not null,
  dedup_decision         text not null check (dedup_decision in ('imported_new','imported_anyway','merged','skipped')),
  created_at             timestamptz not null default now()
);
create index if not exists sourcing_imports_org_idx on sourcing_imports(org_id);
create index if not exists sourcing_imports_ext_idx on sourcing_imports(external_candidate_id);

-- ── Per-org defaults (scoring weights, default mode) ─────────────
create table if not exists sourcing_org_settings (
  org_id          uuid primary key references enterprise_orgs(id) on delete cascade,
  default_weights jsonb not null default '{"skills":35,"title":25,"experience":15,"location":15,"industry":10}',
  default_mode    text not null default 'combined' check (default_mode in ('external','internal','combined')),
  updated_at      timestamptz not null default now()
);
