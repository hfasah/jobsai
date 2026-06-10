-- Interview Session Tracking & Performance Analysis

create table if not exists interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_title text,
  job_description text,
  mode text not null default 'voice', -- voice, avatar, text
  overall_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Individual question responses and feedback
create table if not exists interview_responses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references interview_sessions(id) on delete cascade,
  question_number integer not null,
  question text not null,
  user_answer text not null,
  ai_feedback text,
  star_score integer, -- 0-100: how well they used STAR method
  clarity_score integer, -- 0-100: how clear their answer was
  technical_score integer, -- 0-100: technical accuracy
  confidence_score integer, -- 0-100: confidence level
  created_at timestamptz not null default now()
);

-- Performance summary for the session
create table if not exists interview_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references interview_sessions(id) on delete cascade unique,
  star_score integer, -- average STAR method adherence
  communication_score integer, -- average clarity
  technical_score integer, -- average technical knowledge
  confidence_score integer, -- average confidence
  examples_score integer, -- relevant examples used
  strengths text[], -- array of strength summaries
  improvements text[], -- array of improvement areas
  ai_summary text, -- detailed performance summary
  recommendations text[], -- actionable recommendations
  created_at timestamptz not null default now()
);

create index if not exists interview_sessions_user_idx on interview_sessions(user_id);
create index if not exists interview_sessions_created_idx on interview_sessions(user_id, created_at desc);
create index if not exists interview_responses_session_idx on interview_responses(session_id);
create index if not exists interview_feedback_session_idx on interview_feedback(session_id);
