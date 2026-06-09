-- Lifetime free auto-applies (signup teaser): new accounts can run a few
-- agent applies before any credits are charged. Consumed before credits.
alter table user_tokens add column if not exists free_applies int not null default 3;
