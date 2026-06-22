-- Blog posts ingested from an external content provider (BabyLoveGrowth) via the
-- /api/blog-webhook receiver. The curated posts in src/lib/blog.ts stay as-is;
-- these are merged in at render time. Written only by the service role (webhook);
-- the public blog pages read via the service-role client (SSR), so RLS stays on
-- with no public policy.
create table if not exists blog_posts (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title           text not null,
  excerpt         text,
  content_html    text,
  cover_image_url text,
  author          text,
  tag             text,
  read_mins       integer,
  published_at    timestamptz not null default now(),
  source          text default 'babylovegrowth',
  raw             jsonb,          -- the full webhook payload, for debugging/remapping
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists blog_posts_published_idx on blog_posts (published_at desc);

alter table blog_posts enable row level security;
