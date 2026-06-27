-- 123: keep the original resume FILE for emailed/uploaded candidates so
-- recruiters can download it exactly as sent. Stores the storage key (path) in
-- the private "resumes" bucket; the file is served via a short-lived signed URL
-- through /api/enterprise/inbox/applications/[id]/resume. resume_url is left for
-- genuine external URLs (e.g. careers-portal uploads).
alter table enterprise_applications add column if not exists resume_storage_key text;
