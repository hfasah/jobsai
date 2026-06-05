-- Cancellation feedback: capture why paid users cancel before they hit Stripe portal.
create table if not exists churn_feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  plan       text not null,
  reasons    text[] not null default '{}',
  comment    text,
  wait       boolean not null default false,  -- true = "Send to Team & Wait" (didn't cancel yet)
  created_at timestamptz not null default now()
);

create index if not exists churn_feedback_user_idx on churn_feedback (user_id);
