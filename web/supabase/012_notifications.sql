-- Phase 22: In-app notification center

create table if not exists user_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  type        text not null check (type in (
    'auto_applied', 'manual_required', 'high_match',
    'discovery_summary', 'plan_upgraded'
  )),
  title       text not null,
  body        text not null,
  metadata    jsonb not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists user_notifications_user_idx
  on user_notifications (user_id, created_at desc);

create index if not exists user_notifications_unread_idx
  on user_notifications (user_id)
  where read_at is null;
