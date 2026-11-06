-- Movies and TV shows from TMDB are stored separately from the AniList-keyed
-- anime/manga library so existing data, policies and Phase 2C work are
-- untouched. These tables hold user-owned state only; public TMDB metadata is
-- cached in catalog_cache and snapshotted here so the library still renders if
-- TMDB is briefly unavailable.

create table if not exists public.user_tmdb_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null,
  title text not null,
  original_title text,
  overview text,
  poster_path text,
  backdrop_path text,
  release_date date,
  status text not null default 'planning',
  score integer,
  notes text,
  watched boolean not null default false,
  total_episodes integer,
  started_at date,
  completed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_tmdb_entries_tmdb_id_valid check (tmdb_id > 0),
  constraint user_tmdb_entries_media_type_valid
    check (media_type in ('movie', 'tv')),
  constraint user_tmdb_entries_title_valid
    check (char_length(title) between 1 and 500),
  constraint user_tmdb_entries_status_valid
    check (status in ('watching', 'completed', 'planning', 'on_hold', 'dropped')),
  constraint user_tmdb_entries_score_valid
    check (score is null or (score between 1 and 10)),
  constraint user_tmdb_entries_notes_valid
    check (notes is null or char_length(notes) <= 5000),
  constraint user_tmdb_entries_total_episodes_valid
    check (total_episodes is null or total_episodes >= 0),
  constraint user_tmdb_entries_watched_movie_only
    check (media_type = 'movie' or watched = false),
  constraint user_tmdb_entries_owner_media_key
    unique (user_id, media_type, tmdb_id)
);

create index if not exists user_tmdb_entries_user_updated_idx
  on public.user_tmdb_entries (user_id, updated_at desc);

alter table public.user_tmdb_entries enable row level security;
alter table public.user_tmdb_entries force row level security;

drop policy if exists "user_tmdb_entries_select_own" on public.user_tmdb_entries;
create policy "user_tmdb_entries_select_own"
  on public.user_tmdb_entries for select
  using (auth.uid() = user_id);

drop policy if exists "user_tmdb_entries_insert_own" on public.user_tmdb_entries;
create policy "user_tmdb_entries_insert_own"
  on public.user_tmdb_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_tmdb_entries_update_own" on public.user_tmdb_entries;
create policy "user_tmdb_entries_update_own"
  on public.user_tmdb_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_tmdb_entries_delete_own" on public.user_tmdb_entries;
create policy "user_tmdb_entries_delete_own"
  on public.user_tmdb_entries for delete
  using (auth.uid() = user_id);

drop trigger if exists user_tmdb_entries_set_updated_at on public.user_tmdb_entries;
create trigger user_tmdb_entries_set_updated_at
  before update on public.user_tmdb_entries
  for each row execute function public.set_updated_at();

revoke all on public.user_tmdb_entries from anon;
grant select, insert, update, delete on public.user_tmdb_entries to authenticated;

create table if not exists public.user_tmdb_episodes (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null
    references public.user_tmdb_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  season_number integer not null default 0,
  episode_number integer not null,
  watched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint user_tmdb_episodes_season_valid check (season_number >= 0),
  constraint user_tmdb_episodes_episode_valid check (episode_number > 0),
  constraint user_tmdb_episodes_unique
    unique (entry_id, season_number, episode_number)
);

create index if not exists user_tmdb_episodes_entry_idx
  on public.user_tmdb_episodes (entry_id, season_number, episode_number);
create index if not exists user_tmdb_episodes_user_idx
  on public.user_tmdb_episodes (user_id);

alter table public.user_tmdb_episodes enable row level security;
alter table public.user_tmdb_episodes force row level security;

drop policy if exists "user_tmdb_episodes_select_own" on public.user_tmdb_episodes;
create policy "user_tmdb_episodes_select_own"
  on public.user_tmdb_episodes for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_tmdb_entries entries
      where entries.id = entry_id and entries.user_id = auth.uid()
    )
  );

drop policy if exists "user_tmdb_episodes_insert_own" on public.user_tmdb_episodes;
create policy "user_tmdb_episodes_insert_own"
  on public.user_tmdb_episodes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_tmdb_entries entries
      where entries.id = entry_id and entries.user_id = auth.uid()
    )
  );

drop policy if exists "user_tmdb_episodes_update_own" on public.user_tmdb_episodes;
create policy "user_tmdb_episodes_update_own"
  on public.user_tmdb_episodes for update
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_tmdb_entries entries
      where entries.id = entry_id and entries.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_tmdb_entries entries
      where entries.id = entry_id and entries.user_id = auth.uid()
    )
  );

drop policy if exists "user_tmdb_episodes_delete_own" on public.user_tmdb_episodes;
create policy "user_tmdb_episodes_delete_own"
  on public.user_tmdb_episodes for delete
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_tmdb_entries entries
      where entries.id = entry_id and entries.user_id = auth.uid()
    )
  );

revoke all on public.user_tmdb_episodes from anon;
grant select, insert, update, delete on public.user_tmdb_episodes to authenticated;
