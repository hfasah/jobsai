-- Leads page: a recruiter can pause an individual lead (hold sending, keep the
-- sequence position) and resume it. Add 'paused' to the enrollment status check.
alter table enterprise_campaign_enrollments drop constraint if exists enterprise_campaign_enrollments_status_check;
alter table enterprise_campaign_enrollments add constraint enterprise_campaign_enrollments_status_check
  check (status in ('active', 'paused', 'completed', 'replied', 'unsubscribed', 'bounced', 'removed'));
