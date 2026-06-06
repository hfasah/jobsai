-- Interview Intelligence Framework
-- AI identifies role type → generates a custom weighted scorecard → scores
-- interview transcripts against it. Plus auto-generated candidate reports.

-- One competency framework (weighted scorecard) per job
create table if not exists enterprise_competency_frameworks (
  id              uuid primary key default gen_random_uuid(),
  job_id          uuid not null references enterprise_jobs(id) on delete cascade,
  org_id          uuid not null,
  role_type       text,           -- technical|sales|customer_service|management|healthcare|administrative|general
  role_type_label text,           -- human label e.g. "Sales Role"
  competencies    jsonb not null default '[]',  -- [{name, weight, description, what_to_look_for}]
  company_values  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique(job_id)
);

-- Interview reports per candidate (pre-interview memo + post-interview scoring).
-- A candidate can have many: one pre-interview, plus one per interview round.
create table if not exists enterprise_interview_reports (
  id                uuid primary key default gen_random_uuid(),
  application_id    uuid not null references enterprise_applications(id) on delete cascade,
  job_id            uuid not null,
  org_id            uuid not null,
  report_type       text not null default 'post_interview',  -- pre_interview | post_interview
  round_name        text,           -- "Phone Screen", "Technical Round", "Final"
  transcript        text,
  overall_score     int,            -- 0-100 (weighted)
  competency_scores jsonb default '[]',  -- [{name, weight, score, evidence}]
  strengths         text[] default '{}',
  concerns          text[] default '{}',
  recommendation    text,           -- strong_yes|yes|maybe|no
  summary           text,
  generated_by      text,           -- clerk user_id who triggered it
  generated_at      timestamptz not null default now()
);

create index if not exists ent_frameworks_job_idx   on enterprise_competency_frameworks(job_id);
create index if not exists ent_reports_app_idx       on enterprise_interview_reports(application_id);
create index if not exists ent_reports_job_idx       on enterprise_interview_reports(job_id);
create index if not exists ent_reports_type_idx      on enterprise_interview_reports(report_type);
