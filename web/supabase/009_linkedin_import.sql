-- Phase 15: LinkedIn profile import
-- Expand file_ext constraint to accept 'linkedin' as a source marker

alter table resume_versions
  drop constraint if exists resume_versions_file_ext_check;

alter table resume_versions
  add constraint resume_versions_file_ext_check
  check (file_ext in ('pdf', 'doc', 'docx', 'linkedin'));
