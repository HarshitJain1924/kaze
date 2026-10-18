-- Individual watched-episode records.
-- Tracks exactly which episodes of an anime have been watched by the user.
-- Fully constrained by Row Level Security and scoped to the user's library entry.

create table if not exists public.user_anime_episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  anilist_id integer not null,
  episode_number integer not null,
  watched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint user_anime_episodes_anilist_id_positive check (anilist_id > 0),
  constraint user_anime_episodes_number_positive check (episode_number > 0),
  constraint user_anime_episodes_user_anime_ep_key unique (user_id, anilist_id, episode_number),
  constraint user_anime_episodes_user_anime_fk foreign key (user_id, anilist_id)
    references public.user_anime (user_id, anilist_id) on delete cascade
);

create index if not exists user_anime_episodes_lookup_idx
  on public.user_anime_episodes (user_id, anilist_id, episode_number);

create index if not exists user_anime_episodes_watched_at_idx
  on public.user_anime_episodes (user_id, watched_at desc);

alter table public.user_anime_episodes enable row level security;
alter table public.user_anime_episodes force row level security;

drop policy if exists "user_anime_episodes_select_own" on public.user_anime_episodes;
create policy "user_anime_episodes_select_own"
  on public.user_anime_episodes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_anime_episodes_insert_own" on public.user_anime_episodes;
create policy "user_anime_episodes_insert_own"
  on public.user_anime_episodes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_anime_episodes_update_own" on public.user_anime_episodes;
create policy "user_anime_episodes_update_own"
  on public.user_anime_episodes
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_anime_episodes_delete_own" on public.user_anime_episodes;
create policy "user_anime_episodes_delete_own"
  on public.user_anime_episodes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Only authenticated users may access their episode records.
revoke all on public.user_anime_episodes from anon;
grant select, insert, update, delete on public.user_anime_episodes to authenticated;
