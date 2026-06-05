-- Block list: domains the user never wants to apply to (e.g. current/former
-- employer). Company names already live in user_preferences.excluded_companies.
alter table user_preferences add column if not exists blocked_domains text[] default '{}';
