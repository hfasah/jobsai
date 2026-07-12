-- Email verification status carried onto the enrollment at enroll time, so the
-- campaign wizard can show deliverability per candidate and gate auto-launch on
-- verified/likely-valid addresses. Mirrors the sourcing verifier's values
-- (valid | risky | invalid | unknown); null for manually-added contacts.
alter table enterprise_campaign_enrollments
  add column if not exists email_status text;
