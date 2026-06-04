-- Extend apply_profiles into a full auto-apply application profile.
-- Adds eligibility, full personal info, education & certifications, voluntary
-- self-identification (EEO), and application-behaviour fields used to complete
-- job application forms. All optional.

alter table apply_profiles
  -- Role & experience
  add column if not exists employment_status        text,
  add column if not exists target_experience_level  text,
  add column if not exists industry                 text,
  add column if not exists willing_to_relocate       boolean default false,
  add column if not exists available_from           text,
  -- Personal / address
  add column if not exists address_line1            text,
  add column if not exists address_line2            text,
  add column if not exists postal_code              text,
  add column if not exists date_of_birth            text,
  -- Eligibility
  add column if not exists work_auth_us             text,
  add column if not exists work_auth_canada         text,
  add column if not exists security_clearance       text,
  add column if not exists has_drivers_license       boolean default false,
  -- Education & certifications
  add column if not exists highest_education        text,
  add column if not exists university               text,
  add column if not exists certifications           text[] default '{}',
  -- Voluntary self-identification (EEO)
  add column if not exists race_ethnicity           text,
  add column if not exists nationality              text,
  add column if not exists gender_identity          text,
  add column if not exists sexual_orientation       text,
  add column if not exists transgender              text,
  add column if not exists disability_status        text,
  add column if not exists veteran_status           text,
  -- Application behaviour
  add column if not exists cc_email                 text,
  add column if not exists application_mode         text default 'review';
