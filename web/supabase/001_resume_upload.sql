-- Resume Upload & Parsing schema
-- Run this in your Supabase SQL editor: https://supabase.com/dashboard/project/_/sql

-- ─── resume_documents ────────────────────────────────────────────────────────
-- One logical resume per user (can have many versions)
create table if not exists resume_documents (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,           -- Clerk user ID
  label             text not null default 'My Resume',
  active_version_id uuid,                    -- FK added after resume_versions is created
  is_primary        boolean not null default false,
  is_archived       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists resume_documents_user_id_idx on resume_documents (user_id);
create index if not exists resume_documents_primary_idx on resume_documents (user_id, is_primary) where is_primary = true;

-- ─── resume_versions ─────────────────────────────────────────────────────────
create table if not exists resume_versions (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references resume_documents (id) on delete cascade,
  version_number    int  not null,
  storage_key       text not null,           -- Supabase Storage path
  file_name         text not null,
  file_ext          text not null check (file_ext in ('pdf', 'doc', 'docx')),
  file_mime         text not null,
  file_size_bytes   int  not null check (file_size_bytes >= 0),
  checksum_sha256   text not null,
  upload_status     text not null default 'uploaded'
                      check (upload_status in ('uploaded', 'virus_scanned', 'quarantined', 'failed')),
  parse_status      text not null default 'pending'
                      check (parse_status in ('pending', 'extracting_text', 'parsed', 'partial', 'failed')),
  parse_error_code  text,
  parse_error_msg   text,
  language          text,
  ocr_used          boolean not null default false,
  pages_count       int,
  text_char_count   int,
  uploaded_at       timestamptz not null default now(),
  processed_at      timestamptz,
  deleted_at        timestamptz,
  unique (document_id, version_number)
);

create index if not exists resume_versions_document_id_idx on resume_versions (document_id);
create index if not exists resume_versions_parse_pending_idx on resume_versions (parse_status) where parse_status = 'pending';

-- Back-fill FK now that resume_versions exists
alter table resume_documents
  add constraint resume_documents_active_version_id_fkey
  foreign key (active_version_id) references resume_versions (id)
  on delete set null
  deferrable initially deferred;

-- ─── resume_texts ────────────────────────────────────────────────────────────
create table if not exists resume_texts (
  version_id        uuid primary key references resume_versions (id) on delete cascade,
  plain_text        text not null,
  tokens_count      int,
  embedding_vector_id text
);

-- ─── resume_parsed_profile ───────────────────────────────────────────────────
create table if not exists resume_parsed_profile (
  version_id        uuid primary key references resume_versions (id) on delete cascade,
  full_name         text,
  email             text,
  phone             text,
  location          text,
  headline          text,
  summary           text,
  links             jsonb default '{}',
  years_experience  int,
  parsed_json       jsonb default '{}'     -- full structured parse output
);

-- ─── resume_experiences ──────────────────────────────────────────────────────
create table if not exists resume_experiences (
  id                uuid primary key default gen_random_uuid(),
  version_id        uuid not null references resume_versions (id) on delete cascade,
  idx               int  not null,
  title             text,
  company           text,
  employment_type   text,
  location          text,
  start_date        text,
  end_date          text,
  is_current        boolean default false,
  description       text
);

create index if not exists resume_experiences_version_id_idx on resume_experiences (version_id);

-- ─── resume_educations ───────────────────────────────────────────────────────
create table if not exists resume_educations (
  id                uuid primary key default gen_random_uuid(),
  version_id        uuid not null references resume_versions (id) on delete cascade,
  idx               int  not null,
  school            text,
  degree            text,
  field_of_study    text,
  start_date        text,
  end_date          text,
  grade             text,
  description       text
);

create index if not exists resume_educations_version_id_idx on resume_educations (version_id);

-- ─── resume_skills ───────────────────────────────────────────────────────────
create table if not exists resume_skills (
  id                uuid primary key default gen_random_uuid(),
  version_id        uuid not null references resume_versions (id) on delete cascade,
  skill             text not null,
  category          text,
  confidence        int check (confidence between 0 and 100)
);

create index if not exists resume_skills_version_id_idx on resume_skills (version_id);

-- ─── updated_at trigger ──────────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger resume_documents_updated_at
  before update on resume_documents
  for each row execute function update_updated_at();
