-- Phase 5: Interview Automation
-- Phase 6: Recruiter Intelligence

-- AI-generated interview kits per job
create table if not exists enterprise_interview_kits (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references enterprise_jobs(id) on delete cascade,
  org_id      uuid not null,
  questions   jsonb not null default '[]',  -- [{id, type, question, rubric, max_score}]
  created_at  timestamptz not null default now(),
  unique(job_id)
);

-- Interview sessions (one per candidate per job)
create table if not exists enterprise_interviews (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references enterprise_applications(id) on delete cascade,
  job_id          uuid not null references enterprise_jobs(id) on delete cascade,
  org_id          uuid not null,
  token           text not null unique default encode(gen_random_bytes(24), 'hex'),
  status          text not null default 'invited',  -- invited|in_progress|completed|expired
  invited_at      timestamptz not null default now(),
  started_at      timestamptz,
  completed_at    timestamptz,
  expires_at      timestamptz not null default (now() + interval '7 days'),
  -- AI scores after submission
  overall_score   int,
  communication   int,
  technical       int,
  behavioral      int,
  ai_summary      text,
  ai_recommendation text
);

-- Candidate answers + AI evaluation per question
create table if not exists enterprise_interview_responses (
  id            uuid primary key default gen_random_uuid(),
  interview_id  uuid not null references enterprise_interviews(id) on delete cascade,
  question_id   text not null,
  question_text text not null,
  answer        text,
  ai_score      int,       -- 0-100
  ai_feedback   text,
  created_at    timestamptz not null default now()
);

-- Recruiter copilot conversation history (optional persistence)
create table if not exists enterprise_copilot_sessions (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  user_id    text not null,
  messages   jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists enterprise_kits_job_idx         on enterprise_interview_kits(job_id);
create index if not exists enterprise_interviews_app_idx   on enterprise_interviews(application_id);
create index if not exists enterprise_interviews_token_idx on enterprise_interviews(token);
create index if not exists enterprise_interviews_org_idx   on enterprise_interviews(org_id);
create index if not exists enterprise_responses_int_idx    on enterprise_interview_responses(interview_id);
