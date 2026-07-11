-- AI SDR RBAC column on the per-org override table.
--
-- IMPORTANT: nullable with NO default (same rule as 132). getEffectivePermission()
-- treats any boolean on an override row as authoritative; a `not null default
-- false` would silently hard-deny for every org that already has override rows.
-- NULL falls through to the ROLE_PERMISSIONS defaults in code (owner/admin/
-- recruiter true; others false).
alter table enterprise_role_permissions
  add column if not exists can_manage_ai_sdr boolean;
