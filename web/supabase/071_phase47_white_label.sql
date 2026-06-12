-- Phase 47 Priority 3: White Label — custom domain + email branding

alter table enterprise_orgs
  add column if not exists custom_domain         text unique,
  add column if not exists white_label_email_from text;  -- custom "From" name in emails

create index if not exists enterprise_orgs_custom_domain_idx
  on enterprise_orgs(custom_domain)
  where custom_domain is not null;
