-- Phase 45: AI Voice Screening Agent

alter table enterprise_applications
  add column if not exists voice_screen_status  text check (voice_screen_status in ('calling','processing','complete','failed')),
  add column if not exists voice_call_sid        text,
  add column if not exists voice_recording_url   text,
  add column if not exists voice_questions       jsonb default '[]'::jsonb,
  add column if not exists voice_transcript      text,
  add column if not exists voice_score           int,
  add column if not exists voice_summary         text,
  add column if not exists voice_recommendation  text check (voice_recommendation in ('advance','hold','reject')),
  add column if not exists voice_strengths       jsonb default '[]'::jsonb,
  add column if not exists voice_concerns        jsonb default '[]'::jsonb,
  add column if not exists voice_screened_at     timestamptz;

create index if not exists enterprise_applications_voice_status_idx
  on enterprise_applications(org_id, voice_screen_status)
  where voice_screen_status is not null;
