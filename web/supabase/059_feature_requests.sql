-- Feature Request System

create table if not exists feature_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text not null,
  category text,
  status text not null default 'submitted',
  upvotes integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Track user votes
create table if not exists feature_request_votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null references feature_requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, request_id)
);

create index if not exists feature_requests_user_idx on feature_requests(user_id);
create index if not exists feature_requests_status_idx on feature_requests(status);
create index if not exists feature_request_votes_user_idx on feature_request_votes(user_id);
create index if not exists feature_request_votes_request_idx on feature_request_votes(request_id);
