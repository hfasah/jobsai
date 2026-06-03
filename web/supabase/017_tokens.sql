-- Phase 36 — Token metering layer + interview session persistence
-- The backbone that Phases 37–39 plug into: written/voice/avatar features
-- deduct tokens, plans grant a monthly allowance, top-ups add balance.

-- ── Per-user token balance ──────────────────────────────────────────────────
create table if not exists user_tokens (
  user_id        text primary key,
  balance        int not null default 0,
  monthly_grant  int not null default 0,
  plan           text not null default 'free',
  last_granted_at timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ── Immutable ledger of every token movement (audit + analytics) ────────────
create table if not exists token_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,
  delta         int not null,             -- negative = spend, positive = grant/topup
  balance_after int not null,
  reason        text not null,            -- signup_grant | monthly_grant | written_eval | topup | ...
  feature       text,                     -- written | voice | avatar | resume | cover | ...
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists token_ledger_user_idx on token_ledger(user_id, created_at desc);

-- ── Interview sessions (written now; voice/avatar in 37/38) ─────────────────
create table if not exists interview_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  job_id         uuid references jobs(id) on delete cascade,
  mode           text not null default 'written' check (mode in ('written','voice','avatar')),
  interview_type text,                     -- behavioral | technical | leadership | mixed
  overall_score  numeric,                  -- 1–5
  subscores      jsonb not null default '{}'::jsonb,
  question_count int not null default 0,
  tokens_spent   int not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists interview_sessions_user_idx on interview_sessions(user_id, created_at desc);
create index if not exists interview_sessions_job_idx on interview_sessions(job_id);
