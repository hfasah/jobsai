-- Magic-link partner portal: a long random token lets a verified partner view
-- their dashboard (referrals, earnings, payout details) without a JobsAI login.
alter table partner_accounts add column if not exists portal_token text;
create unique index if not exists uniq_partner_portal_token on partner_accounts (portal_token) where portal_token is not null;
