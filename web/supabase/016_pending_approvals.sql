-- Approval queue for auto-apply review
create table if not exists pending_approvals (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  job_id      uuid not null references jobs(id) on delete cascade,
  match_score int  not null default 0,
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'rejected', 'applied', 'failed')),
  created_at  timestamptz default now(),
  reviewed_at timestamptz
);

-- Only one pending row per user+job at a time
create unique index if not exists pending_approvals_user_job_pending_uniq
  on pending_approvals(user_id, job_id) where status = 'pending';

create index if not exists pending_approvals_user_status_idx
  on pending_approvals(user_id, status);

-- New preference: require manual approval before auto-applying
alter table user_preferences
  add column if not exists require_approval boolean not null default false;
