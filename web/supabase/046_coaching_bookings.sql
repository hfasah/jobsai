-- 1:1 human career coaching bookings.
-- Career Accelerator includes 1 free 45-min session/month; everyone (incl. extra
-- Accelerator sessions) can book and pay with tokens (≈ $75 / 25,000 tokens).
-- Zoom link + calendar invite are filled in later when scheduling is connected.
create table if not exists coaching_bookings (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  plan            text not null,                       -- plan at time of booking
  paid_with       text not null,                       -- 'included' | 'tokens'
  tokens_spent    int  not null default 0,
  minutes         int  not null default 45,
  status          text not null default 'requested',   -- requested | scheduled | completed | cancelled
  preferred_times text,                                -- free-text availability from the user
  notes           text,
  zoom_link       text,                                -- added when scheduled (later)
  calendar_event_id text,                              -- added when scheduled (later)
  scheduled_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists coaching_bookings_user_idx on coaching_bookings (user_id, created_at desc);
