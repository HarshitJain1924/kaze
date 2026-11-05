-- Phase 2B: additive canonical media and library schema.
--
-- Existing user_anime, user_anime_episodes and catalog_cache tables remain
-- authoritative until a separate approved cutover. This migration only creates
-- new tables and policies; it never drops, renames or rewrites legacy tables.

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_kind_valid
    check (kind in ('anime', 'manga', 'movie', 'tv')),
  -- Required as the target of kind-safe composite foreign keys below.
  constraint media_id_kind_key unique (id, kind)
);

create table if not exists public.media_external_ids (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null,
  provider text not null,
  external_id text not null,
  source_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_external_ids_provider_valid
    check (provider in ('anilist', 'kitsu', 'tmdb', 'mal', 'mangadex')),
  constraint media_external_ids_external_id_valid
    check (
      char_length(external_id) between 1 and 200
      and (
        provider <> 'anilist'
        or external_id ~ '^[1-9][0-9]*$'
      )
    ),
  constraint media_external_ids_source_url_valid
    check (source_url is null or source_url ~* '^https?://'),
  constraint media_external_ids_provider_external_key
    unique (provider, external_id),
  constraint media_external_ids_media_fk
    foreign key (media_id) references public.media (id) on delete restrict
);

create index if not exists media_external_ids_media_idx
  on public.media_external_ids (media_id);
create index if not exists media_external_ids_provider_idx
  on public.media_external_ids (provider);

create table if not exists public.media_titles (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null,
  language text,
  title text not null,
  title_type text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_titles_title_valid
    check (char_length(btrim(title)) between 1 and 500),
  constraint media_titles_type_valid
    check (title_type in ('primary', 'romaji', 'english', 'native', 'alternate')),
  constraint media_titles_language_valid
    check (language is null or char_length(btrim(language)) between 1 and 35),
  constraint media_titles_media_fk
    foreign key (media_id) references public.media (id) on delete cascade
);

create unique index if not exists media_titles_primary_idx
  on public.media_titles (media_id)
  where is_primary;
create unique index if not exists media_titles_identity_idx
  on public.media_titles (media_id, title_type, coalesce(language, ''), lower(title));
create index if not exists media_titles_media_idx
  on public.media_titles (media_id);

create table if not exists public.media_artwork (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null,
  provider text not null,
  role text not null,
  url text not null,
  width integer,
  height integer,
  aspect_ratio numeric(10, 6),
  focal_x numeric(5, 4),
  focal_y numeric(5, 4),
  language text,
  attribution text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_artwork_provider_valid
    check (provider in ('anilist', 'kitsu', 'tmdb', 'mal', 'mangadex')),
  constraint media_artwork_role_valid
    check (role in ('poster', 'backdrop', 'banner', 'logo')),
  constraint media_artwork_url_valid
    check (url ~* '^https?://'),
  constraint media_artwork_dimensions_positive
    check (
      (width is null or width > 0)
      and (height is null or height > 0)
    ),
  constraint media_artwork_aspect_ratio_positive
    check (aspect_ratio is null or aspect_ratio > 0),
  constraint media_artwork_focal_point_valid
    check (
      (focal_x is null and focal_y is null)
      or (
        focal_x is not null
        and focal_y is not null
        and focal_x between 0 and 1
        and focal_y between 0 and 1
      )
    ),
  constraint media_artwork_role_orientation_valid
    check (
      (role <> 'poster' or width is null or height is null or width <= height)
      and (
        role not in ('backdrop', 'banner')
        or width is null
        or height is null
        or width >= height
      )
    ),
  constraint media_artwork_media_fk
    foreign key (media_id) references public.media (id) on delete cascade
);

create unique index if not exists media_artwork_primary_role_idx
  on public.media_artwork (media_id, role)
  where is_primary;
create index if not exists media_artwork_media_role_idx
  on public.media_artwork (media_id, role);

-- Type-specific extension tables. Each row carries the kind it represents and
-- references media(id, kind), so a movie detail row cannot point at an anime.
create table if not exists public.media_anime_details (
  media_id uuid primary key,
  kind text not null default 'anime',
  episodes integer,
  duration_minutes integer,
  country_of_origin text,
  season text,
  studios text[] not null default '{}',
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_anime_details_kind_valid check (kind = 'anime'),
  constraint media_anime_details_episodes_nonnegative
    check (episodes is null or episodes >= 0),
  constraint media_anime_details_duration_positive
    check (duration_minutes is null or duration_minutes > 0),
  constraint media_anime_details_media_kind_fk
    foreign key (media_id, kind) references public.media (id, kind) on delete cascade
);

create table if not exists public.media_manga_details (
  media_id uuid primary key,
  kind text not null default 'manga',
  chapters integer,
  volumes integer,
  country_of_origin text,
  authors text[] not null default '{}',
  artists text[] not null default '{}',
  publication_status text,
  reading_format text,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_manga_details_kind_valid check (kind = 'manga'),
  constraint media_manga_details_chapters_nonnegative
    check (chapters is null or chapters >= 0),
  constraint media_manga_details_volumes_nonnegative
    check (volumes is null or volumes >= 0),
  constraint media_manga_details_media_kind_fk
    foreign key (media_id, kind) references public.media (id, kind) on delete cascade
);

create table if not exists public.media_movie_details (
  media_id uuid primary key,
  kind text not null default 'movie',
  runtime_minutes integer,
  release_date date,
  production_companies text[] not null default '{}',
  cast_members jsonb not null default '[]',
  crew_members jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_movie_details_kind_valid check (kind = 'movie'),
  constraint media_movie_details_runtime_positive
    check (runtime_minutes is null or runtime_minutes > 0),
  constraint media_movie_details_cast_array
    check (jsonb_typeof(cast_members) = 'array'),
  constraint media_movie_details_crew_array
    check (jsonb_typeof(crew_members) = 'array'),
  constraint media_movie_details_media_kind_fk
    foreign key (media_id, kind) references public.media (id, kind) on delete cascade
);

create table if not exists public.media_tv_details (
  media_id uuid primary key,
  kind text not null default 'tv',
  season_count integer,
  episode_count integer,
  episode_runtime_minutes integer,
  networks text[] not null default '{}',
  next_episode jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint media_tv_details_kind_valid check (kind = 'tv'),
  constraint media_tv_details_season_count_nonnegative
    check (season_count is null or season_count >= 0),
  constraint media_tv_details_episode_count_nonnegative
    check (episode_count is null or episode_count >= 0),
  constraint media_tv_details_runtime_positive
    check (episode_runtime_minutes is null or episode_runtime_minutes > 0),
  constraint media_tv_details_next_episode_object
    check (next_episode is null or jsonb_typeof(next_episode) = 'object'),
  constraint media_tv_details_media_kind_fk
    foreign key (media_id, kind) references public.media (id, kind) on delete cascade
);

create table if not exists public.user_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  media_id uuid not null,
  media_kind text not null,
  status text not null default 'planning',
  episodes_watched integer,
  chapters_read integer,
  volumes_read integer,
  movie_watched boolean,
  tv_season_number integer,
  tv_episode_number integer,
  tv_episodes_watched integer,
  score smallint,
  favorite boolean not null default false,
  notes text,
  rewatch_count integer not null default 0,
  started_at date,
  completed_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_media_kind_valid
    check (media_kind in ('anime', 'manga', 'movie', 'tv')),
  constraint user_media_status_valid
    check (status in ('watching', 'completed', 'planning', 'on_hold', 'dropped')),
  constraint user_media_progress_nonnegative
    check (
      (episodes_watched is null or episodes_watched >= 0)
      and (chapters_read is null or chapters_read >= 0)
      and (volumes_read is null or volumes_read >= 0)
      and (tv_season_number is null or tv_season_number >= 0)
      and (tv_episode_number is null or tv_episode_number >= 0)
      and (tv_episodes_watched is null or tv_episodes_watched >= 0)
    ),
  constraint user_media_progress_shape
    check (
      (
        media_kind = 'anime'
        and episodes_watched is not null
        and chapters_read is null
        and volumes_read is null
        and movie_watched is null
        and tv_season_number is null
        and tv_episode_number is null
        and tv_episodes_watched is null
      )
      or (
        media_kind = 'manga'
        and episodes_watched is null
        and chapters_read is not null
        and volumes_read is not null
        and movie_watched is null
        and tv_season_number is null
        and tv_episode_number is null
        and tv_episodes_watched is null
      )
      or (
        media_kind = 'movie'
        and episodes_watched is null
        and chapters_read is null
        and volumes_read is null
        and movie_watched is not null
        and tv_season_number is null
        and tv_episode_number is null
        and tv_episodes_watched is null
      )
      or (
        media_kind = 'tv'
        and episodes_watched is null
        and chapters_read is null
        and volumes_read is null
        and movie_watched is null
        and tv_season_number is not null
        and tv_episode_number is not null
        and tv_episodes_watched is not null
      )
    ),
  constraint user_media_score_range
    check (score is null or score between 1 and 10),
  constraint user_media_notes_length
    check (notes is null or char_length(notes) <= 5000),
  constraint user_media_rewatch_count_nonnegative
    check (rewatch_count >= 0),
  constraint user_media_user_media_key unique (user_id, media_id),
  constraint user_media_id_user_key unique (id, user_id),
  constraint user_media_id_user_kind_key unique (id, user_id, media_kind),
  constraint user_media_media_kind_fk
    foreign key (media_id, media_kind) references public.media (id, kind)
    on delete restrict
);

create index if not exists user_media_user_status_idx
  on public.user_media (user_id, status);
create index if not exists user_media_user_updated_idx
  on public.user_media (user_id, updated_at desc);
create index if not exists user_media_media_idx
  on public.user_media (media_id);

create table if not exists public.user_media_episodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  user_media_id uuid not null,
  media_kind text not null default 'anime',
  season_number integer not null default 0,
  episode_number integer not null,
  watched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint user_media_episodes_season_nonnegative
    check (season_number >= 0),
  constraint user_media_episodes_number_positive
    check (episode_number > 0),
  constraint user_media_episodes_media_kind_valid
    check (media_kind in ('anime', 'tv')),
  constraint user_media_episodes_user_media_key
    unique (user_media_id, season_number, episode_number),
  constraint user_media_episodes_owner_kind_fk
    foreign key (user_media_id, user_id, media_kind)
    references public.user_media (id, user_id, media_kind) on delete cascade
);

create index if not exists user_media_episodes_lookup_idx
  on public.user_media_episodes (user_media_id, season_number, episode_number);
create index if not exists user_media_episodes_user_idx
  on public.user_media_episodes (user_id);
create index if not exists user_media_episodes_media_kind_idx
  on public.user_media_episodes (media_kind);

-- Service-only ledger for malformed or conflicting legacy rows. It is not
-- exposed to authenticated users, even though some entries contain user IDs.
create table if not exists public.media_backfill_issues (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  legacy_table text not null,
  legacy_id text not null,
  reason text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint media_backfill_issues_run_legacy_reason_key
    unique (run_id, legacy_table, legacy_id, reason)
);

create index if not exists media_backfill_issues_run_idx
  on public.media_backfill_issues (run_id, resolved_at);

-- Keep updated_at server-authoritative on the additive tables too.
drop trigger if exists media_set_updated_at on public.media;
create trigger media_set_updated_at
  before update on public.media
  for each row execute function public.set_updated_at();

drop trigger if exists media_external_ids_set_updated_at on public.media_external_ids;
create trigger media_external_ids_set_updated_at
  before update on public.media_external_ids
  for each row execute function public.set_updated_at();

drop trigger if exists media_titles_set_updated_at on public.media_titles;
create trigger media_titles_set_updated_at
  before update on public.media_titles
  for each row execute function public.set_updated_at();

drop trigger if exists media_artwork_set_updated_at on public.media_artwork;
create trigger media_artwork_set_updated_at
  before update on public.media_artwork
  for each row execute function public.set_updated_at();

drop trigger if exists media_anime_details_set_updated_at on public.media_anime_details;
create trigger media_anime_details_set_updated_at
  before update on public.media_anime_details
  for each row execute function public.set_updated_at();

drop trigger if exists media_manga_details_set_updated_at on public.media_manga_details;
create trigger media_manga_details_set_updated_at
  before update on public.media_manga_details
  for each row execute function public.set_updated_at();

drop trigger if exists media_movie_details_set_updated_at on public.media_movie_details;
create trigger media_movie_details_set_updated_at
  before update on public.media_movie_details
  for each row execute function public.set_updated_at();

drop trigger if exists media_tv_details_set_updated_at on public.media_tv_details;
create trigger media_tv_details_set_updated_at
  before update on public.media_tv_details
  for each row execute function public.set_updated_at();

drop trigger if exists user_media_set_updated_at on public.user_media;
create trigger user_media_set_updated_at
  before update on public.user_media
  for each row execute function public.set_updated_at();

-- Catalogue tables are server-owned. No policies exist for anon/authenticated;
-- the service role bypasses RLS and is the only reader/writer for now.
alter table public.media enable row level security;
alter table public.media force row level security;
alter table public.media_external_ids enable row level security;
alter table public.media_external_ids force row level security;
alter table public.media_titles enable row level security;
alter table public.media_titles force row level security;
alter table public.media_artwork enable row level security;
alter table public.media_artwork force row level security;
alter table public.media_anime_details enable row level security;
alter table public.media_anime_details force row level security;
alter table public.media_manga_details enable row level security;
alter table public.media_manga_details force row level security;
alter table public.media_movie_details enable row level security;
alter table public.media_movie_details force row level security;
alter table public.media_tv_details enable row level security;
alter table public.media_tv_details force row level security;
alter table public.media_backfill_issues enable row level security;
alter table public.media_backfill_issues force row level security;

revoke all on public.media from anon, authenticated;
revoke all on public.media_external_ids from anon, authenticated;
revoke all on public.media_titles from anon, authenticated;
revoke all on public.media_artwork from anon, authenticated;
revoke all on public.media_anime_details from anon, authenticated;
revoke all on public.media_manga_details from anon, authenticated;
revoke all on public.media_movie_details from anon, authenticated;
revoke all on public.media_tv_details from anon, authenticated;
revoke all on public.media_backfill_issues from anon, authenticated;

grant select, insert, update, delete on public.media to service_role;
grant select, insert, update, delete on public.media_external_ids to service_role;
grant select, insert, update, delete on public.media_titles to service_role;
grant select, insert, update, delete on public.media_artwork to service_role;
grant select, insert, update, delete on public.media_anime_details to service_role;
grant select, insert, update, delete on public.media_manga_details to service_role;
grant select, insert, update, delete on public.media_movie_details to service_role;
grant select, insert, update, delete on public.media_tv_details to service_role;
grant select, insert, update, delete on public.media_backfill_issues to service_role;

-- Personal library tables use the same ownership boundary as the legacy
-- tables: authenticated users may only touch rows whose user_id is auth.uid().
alter table public.user_media enable row level security;
alter table public.user_media force row level security;
alter table public.user_media_episodes enable row level security;
alter table public.user_media_episodes force row level security;

drop policy if exists "user_media_select_own" on public.user_media;
create policy "user_media_select_own"
  on public.user_media
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_media_insert_own" on public.user_media;
create policy "user_media_insert_own"
  on public.user_media
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_media_update_own" on public.user_media;
create policy "user_media_update_own"
  on public.user_media
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_media_delete_own" on public.user_media;
create policy "user_media_delete_own"
  on public.user_media
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_media_episodes_select_own" on public.user_media_episodes;
create policy "user_media_episodes_select_own"
  on public.user_media_episodes
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_media_episodes_insert_own" on public.user_media_episodes;
create policy "user_media_episodes_insert_own"
  on public.user_media_episodes
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_media_episodes_update_own" on public.user_media_episodes;
create policy "user_media_episodes_update_own"
  on public.user_media_episodes
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_media_episodes_delete_own" on public.user_media_episodes;
create policy "user_media_episodes_delete_own"
  on public.user_media_episodes
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.user_media from anon;
revoke all on public.user_media_episodes from anon;
grant select, insert, update, delete on public.user_media to authenticated, service_role;
grant select, insert, update, delete on public.user_media_episodes to authenticated, service_role;
