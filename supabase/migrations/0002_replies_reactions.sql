-- Our Little Corner - replies & reactions
-- Purely additive: does NOT alter public.posts (its columns, constraints,
-- or existing rows) in any way. Run this in the Supabase SQL editor (or via
-- `supabase db push`) after reviewing it.

-- ---------------------------------------------------------------------------
-- replies
-- One row per reply. Linked to posts via post_id; deleting a post cascades
-- to its replies (same lifecycle - a reply can't outlive the post it's on).
-- ---------------------------------------------------------------------------
create table if not exists public.replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author text not null,
  content text not null check (char_length(btrim(content)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists replies_post_id_idx on public.replies (post_id, created_at);

-- ---------------------------------------------------------------------------
-- reactions
-- One row per (post, user, emoji). user_id tracks who reacted so a person
-- can toggle their own reaction on/off and so the UI can highlight "your"
-- reactions; the unique constraint stops the same person double-reacting
-- with the same emoji.
-- ---------------------------------------------------------------------------
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id text not null,
  reaction_type text not null check (reaction_type in ('❤️', '😂', '😮', '😢', '🔥', '👍')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id, reaction_type)
);

create index if not exists reactions_post_id_idx on public.reactions (post_id);

-- ---------------------------------------------------------------------------
-- Row Level Security - same pattern as `posts` (see 0001_init.sql): all
-- writes happen from trusted server code using the service_role key, which
-- bypasses RLS entirely, so no write policies are defined here on purpose -
-- that's a deliberate default-deny. Reads are allowed to the `authenticated`
-- role only (a valid Clerk session, via Supabase's Third-Party Auth).
-- ---------------------------------------------------------------------------
alter table public.replies enable row level security;
alter table public.reactions enable row level security;

drop policy if exists "authenticated can read replies" on public.replies;
create policy "authenticated can read replies"
  on public.replies
  for select
  to authenticated
  using (true);

drop policy if exists "authenticated can read reactions" on public.reactions;
create policy "authenticated can read reactions"
  on public.reactions
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Realtime - so reply threads and reaction counts update live for both of
-- you, the same way new posts already do.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.replies;
alter publication supabase_realtime add table public.reactions;
