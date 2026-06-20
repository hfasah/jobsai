-- Shared cache for on-demand UI/document translations (enterprise app).
-- Keyed by a hash of the source string + target language, so common strings
-- (menus, labels) are translated by the AI exactly once and then served from
-- here for every user — big cost + latency win over per-user caching.
create table if not exists ui_translation_cache (
  source_hash     text not null,
  target_lang     text not null,
  source_text     text not null,
  translated_text text not null,
  created_at      timestamptz not null default now(),
  primary key (source_hash, target_lang)
);

-- Server-only (accessed via the service role in /api/translate); no RLS policies.
alter table ui_translation_cache enable row level security;
