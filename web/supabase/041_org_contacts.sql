-- Primary + secondary contact people for an enterprise org (for admin support).
alter table enterprise_orgs
  add column if not exists contact_name   text,
  add column if not exists contact_email  text,
  add column if not exists contact_phone  text,
  add column if not exists contact2_name  text,
  add column if not exists contact2_email text,
  add column if not exists contact2_phone text;
