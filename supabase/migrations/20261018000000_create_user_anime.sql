-- Personal anime library.
-- One row per (user, AniList anime), owned by the authenticated user.
-- All access is additionally constrained by row level security.

create table if not exists public.user_anime (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  anilist_id integer not null,
  status text not null default 'planning',
  progress integer not null default 0,
  score smallint,
  started_at date,
  completed_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_anime_anilist_id_positive check (anilist_id > 0),
  constraint user_anime_status_valid check (
    status in ('watching', 'completed', 'planning', 'on_hold', 'dropped')
  ),
  constraint user_anime_progress_nonnegative check (progress >= 0),
  constraint user_anime_score_range check (score is null or score between 1 and 10),
  constraint user_anime_notes_length check (
    notes is null or char_length(notes) <= 5000
  ),
  constraint user_anime_user_anilist_key unique (user_id, anilist_id)
);

create index if not exists user_anime_user_status_idx
  on public.user_anime (user_id, status);

create index if not exists user_anime_user_updated_idx
  on public.user_anime (user_id, updated_at desc);

-- Keep updated_at authoritative on the server.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_anime_set_updated_at on public.user_anime;
create trigger user_anime_set_updated_at
  before update on public.user_anime
  for each row execute function public.set_updated_at();

alter table public.user_anime enable row level security;
alter table public.user_anime force row level security;

drop policy if exists "user_anime_select_own" on public.user_anime;
create policy "user_anime_select_own"
  on public.user_anime
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "user_anime_insert_own" on public.user_anime;
create policy "user_anime_insert_own"
  on public.user_anime
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_anime_update_own" on public.user_anime;
create policy "user_anime_update_own"
  on public.user_anime
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "user_anime_delete_own" on public.user_anime;
create policy "user_anime_delete_own"
  on public.user_anime
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Only authenticated users may touch this table; anonymous visitors never
-- have access even if a policy were misconfigured.
revoke all on public.user_anime from anon;
grant select, insert, update, delete on public.user_anime to authenticated;
