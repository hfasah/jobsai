-- TalentSource RBAC columns on the per-org override table.
--
-- IMPORTANT: these are nullable with NO default, unlike the original 074
-- columns. getEffectivePermission() treats any boolean value on an override
-- row as authoritative; a `not null default false` here would silently
-- hard-deny the new permissions for every org that already has override rows.
-- NULL falls through to the ROLE_PERMISSIONS defaults in code.
alter table enterprise_role_permissions
  add column if not exists can_source_external boolean,
  add column if not exists can_reveal_contacts boolean,
  add column if not exists can_import_sourced  boolean,
  add column if not exists can_export_sourced  boolean,
  add column if not exists can_manage_sourcing boolean;
