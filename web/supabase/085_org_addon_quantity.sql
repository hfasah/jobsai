-- 085: add-on quantity (for per-seat add-ons like extra_recruiter)
alter table org_addons add column if not exists quantity int not null default 1;
