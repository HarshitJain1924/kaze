-- Manga/manhwa support for the personal library.
--
-- This is intentionally an additive migration: existing anime rows and every
-- RLS policy, index and trigger remain valid. `anilist_id` stores the AniList
-- media id, which is shared by anime and manga.
--
-- `progress` keeps its meaning per medium:
--   anime -> episodes watched
--   manga -> chapters read
-- `volumes_progress` is only used for manga and is optional.

alter table public.user_anime
  add column if not exists media_type text not null default 'anime',
  add column if not exists volumes_progress integer not null default 0;

alter table public.user_anime
  drop constraint if exists user_anime_media_type_valid,
  drop constraint if exists user_anime_volumes_progress_nonnegative;

alter table public.user_anime
  add constraint user_anime_media_type_valid
    check (media_type in ('anime', 'manga')),
  add constraint user_anime_volumes_progress_nonnegative
    check (volumes_progress >= 0);

create index if not exists user_anime_user_media_type_status_idx
  on public.user_anime (user_id, media_type, status);

comment on column public.user_anime.media_type is
  'anime or manga. Manhwa/manhua are manga with a KR/CN/TW country of origin.';
comment on column public.user_anime.progress is
  'Episodes watched for anime; chapters read for manga.';
comment on column public.user_anime.volumes_progress is
  'Volumes read for manga. Always 0 for anime.';

-- Episode rows are anime-only by design: manga progress is aggregate chapter
-- progress, so no per-chapter records are created.
comment on table public.user_anime_episodes is
  'Individual watched-episode records for anime entries only. Manga uses aggregate chapter progress.';
