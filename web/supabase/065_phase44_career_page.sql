-- Phase 44: Career Page & Employer Branding enhancements

alter table enterprise_orgs
  add column if not exists cover_image_url  text,
  add column if not exists culture_text     text,
  add column if not exists benefits         jsonb default '[]'::jsonb,
  add column if not exists social_links     jsonb default '{}'::jsonb;
