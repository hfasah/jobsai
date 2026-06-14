-- 095: Direct Loxo ATS integration. Loxo isn't on Merge, so we connect with the
-- customer's own API key + agency slug. Reuses enterprise_ats_connections
-- (provider='loxo', account_token = Loxo API key); adds agency_slug for routing.
alter table enterprise_ats_connections add column if not exists agency_slug text;
