-- Add a dedicated display name (how we greet the user on the dashboard),
-- separate from the legal first/last name used on job applications.
alter table apply_profiles add column if not exists display_name text;
