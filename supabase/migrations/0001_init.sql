-- Our Little Corner - initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id text not null,
  author_name text not null,
  type text not null default 'post' check (type in ('post', 'daily_photo')),
  body text,
  drawing_path text,
  media jsonb not null default '[]'::jsonb,
  voice_path text,
  created_at timestamptz not null default now()
);

comment on column public.posts.media is
  'Array of {path, mime, kind} objects for uploaded photos/videos, kind is "image" or "video"';

create index if not exists posts_created_at_idx on public.posts (created_at desc);

-- ---------------------------------------------------------------------------
-- photo_pool (the "daily photo" pool)
-- ---------------------------------------------------------------------------
create table if not exists public.photo_pool (
  id uuid primary key default gen_random_uuid(),
  file_path text not null,
  uploaded_by text,
  used boolean not null default false,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists photo_pool_used_idx on public.photo_pool (used);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- Writes (INSERT/UPDATE/DELETE) only ever happen from trusted server code
-- (Next.js route handlers using the service_role key, or the post-daily-photo
-- Edge Function), which bypasses RLS entirely. So no write policies are
-- defined here on purpose - that's a deliberate default-deny.
--
-- Reads are allowed to the Postgres `authenticated` role only. That role is
-- what Supabase maps a request to once you've wired up Clerk as a
-- "Third-Party Auth" provider (see README) - i.e. only requests carrying a
-- valid Clerk session token get in. This is what makes the Supabase Realtime
-- subscription on `posts` privacy-safe: without a valid Clerk session, no
-- rows and no realtime events are visible at all.
-- ---------------------------------------------------------------------------
alter table public.posts enable row level security;
alter table public.photo_pool enable row level security;

drop policy if exists "authenticated can read posts" on public.posts;
create policy "authenticated can read posts"
  on public.posts
  for select
  to authenticated
  using (true);

-- photo_pool is only ever touched via the service role (manage page uploads,
-- the cron Edge Function), so intentionally no policies -> fully locked down
-- to everyone except service_role.

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.posts;

-- ---------------------------------------------------------------------------
-- Storage bucket for post media (drawings, photos/videos, voice notes, and
-- the daily-photo pool). Kept PUBLIC for simplicity: object paths are
-- unguessable random UUIDs, so this is "unlisted link" security, not
-- account-gated security. If you want stricter access, flip this bucket to
-- private and switch the app to signed URLs (see README for notes).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('board-media', 'board-media', true)
on conflict (id) do nothing;
