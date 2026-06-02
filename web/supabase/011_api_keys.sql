-- Phase 18: Personal API keys for the Chrome extension
alter table user_billing
  add column if not exists extension_api_key text unique;

create index if not exists user_billing_api_key_idx
  on user_billing (extension_api_key)
  where extension_api_key is not null;
