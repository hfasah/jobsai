-- Founding Partner flag: the first N partners lock a higher commission rate.
-- Stored explicitly so the rate stays locked and we can badge them in the UI.
alter table partner_accounts add column if not exists is_founding boolean not null default false;
