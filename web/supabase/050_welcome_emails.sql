-- Idempotency for the signup welcome email so Clerk webhook retries (or a
-- user.created + first-login double-trigger) never send it twice.
create table if not exists welcome_emails (
  user_id  text primary key,
  email    text,
  sent_at  timestamptz not null default now()
);
