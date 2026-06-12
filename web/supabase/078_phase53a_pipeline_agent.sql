-- Phase 53A: Autonomous Recruiting Agent
-- Pipeline rules evaluated after every screening; agent actions log

create table if not exists enterprise_pipeline_rules (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references enterprise_orgs(id) on delete cascade,
  job_id        uuid references enterprise_jobs(id) on delete cascade,  -- null = org-wide
  name          text not null,
  description   text,
  trigger_event text not null default 'application_screened',  -- application_screened | application_created
  -- conditions: [{field, operator, value}] — all ANDed
  -- fields: match_score, ats_score, ai_recommendation, risk_flags, ats_keywords_matched
  -- operators: gte, lte, gt, lt, eq, neq, contains_all, contains_any, is_empty, not_empty
  conditions    jsonb not null default '[]',
  -- action: move_stage | auto_reject | add_tag | notify_hm | send_interview_invite
  action        text not null,
  action_config jsonb not null default '{}',
  active        boolean not null default true,
  run_count     integer not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists enterprise_agent_actions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null,
  rule_id         uuid references enterprise_pipeline_rules(id) on delete set null,
  rule_name       text,
  application_id  uuid references enterprise_applications(id) on delete set null,
  candidate_name  text,
  job_title       text,
  action          text not null,
  result          text not null default 'success',  -- success | skipped | error
  details         jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists pipeline_rules_org_idx    on enterprise_pipeline_rules(org_id);
create index if not exists pipeline_rules_job_idx    on enterprise_pipeline_rules(job_id);
create index if not exists agent_actions_org_idx     on enterprise_agent_actions(org_id, created_at desc);
create index if not exists agent_actions_app_idx     on enterprise_agent_actions(application_id);
