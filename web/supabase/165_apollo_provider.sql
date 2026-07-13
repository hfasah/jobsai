-- Allow 'apollo' as a per-org sourcing provider config value. (The platform
-- default resolves Apollo from APOLLO_API_KEY without a row, so this is only
-- needed for explicit per-org provider configuration.)
alter table sourcing_providers drop constraint if exists sourcing_providers_provider_key_check;
alter table sourcing_providers add constraint sourcing_providers_provider_key_check
  check (provider_key in ('mock', 'pdl', 'apollo'));
