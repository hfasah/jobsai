-- Phase 11: Scheduled Auto-Discovery
-- Run in Supabase SQL editor after 007_apply_profile.sql

alter table user_preferences
  add column if not exists last_discovery_at    timestamptz,
  add column if not exists last_discovery_count int not null default 0;
