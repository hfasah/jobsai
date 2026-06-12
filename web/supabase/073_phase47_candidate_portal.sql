-- Phase 47 Priority 5: Candidate Portal — status lookup token

alter table enterprise_applications
  add column if not exists status_token text unique default encode(gen_random_bytes(20), 'hex'),
  add column if not exists portal_viewed_at timestamptz,
  add column if not exists portal_view_count integer not null default 0;

create index if not exists enterprise_applications_status_token_idx
  on enterprise_applications(status_token);
