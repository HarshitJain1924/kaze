-- Phase 2C: additive coordination, projection health, and legacy-backed reads.
--
-- Legacy user_anime and user_anime_episodes remain authoritative. This
-- migration does not change application routes or permit canonical-to-legacy
-- writes. Coordination and projection-state rows are durable tombstone and
-- revision records and therefore have no runtime DELETE privilege or policy.

create schema if not exists private;
revoke all on schema private from public;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'phase2c_api_owner') then
    create role phase2c_api_owner nologin nosuperuser nobypassrls noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'phase2c_reconcile_owner') then
    create role phase2c_reconcile_owner nologin nosuperuser nobypassrls noinherit;
  end if;
end
$$;

alter role phase2c_api_owner nologin nosuperuser nobypassrls noinherit;
alter role phase2c_reconcile_owner nologin nosuperuser nobypassrls noinherit;
grant usage on schema private to phase2c_api_owner;

-- These owners must not inherit application or administrative authority.
revoke service_role, authenticated, anon from phase2c_api_owner;
revoke service_role, authenticated, anon from phase2c_reconcile_owner;

create table if not exists public.phase2c_entry_coordination (
  user_id uuid not null references auth.users (id) on delete cascade,
  anilist_id integer not null,
  generation bigint not null default 0,
  deleted boolean not null default false,
  source_revision bigint not null default 0,
  lifecycle_version bigint not null default 0,
  progress_version bigint not null default 0,
  score_version bigint not null default 0,
  notes_version bigint not null default 0,
  constraint phase2c_entry_coordination_pk primary key (user_id, anilist_id),
  constraint phase2c_entry_coordination_anilist_positive check (anilist_id > 0),
  constraint phase2c_entry_coordination_generation_nonnegative check (generation >= 0),
  constraint phase2c_entry_coordination_source_revision_nonnegative check (source_revision >= 0),
  constraint phase2c_entry_coordination_lifecycle_nonnegative check (lifecycle_version >= 0),
  constraint phase2c_entry_coordination_progress_nonnegative check (progress_version >= 0),
  constraint phase2c_entry_coordination_score_nonnegative check (score_version >= 0),
  constraint phase2c_entry_coordination_notes_nonnegative check (notes_version >= 0)
);

create table if not exists public.phase2c_projection_state (
  user_id uuid not null,
  anilist_id integer not null,
  generation bigint not null default 0,
  projection_revision bigint not null default 0,
  projected_deleted boolean not null default false,
  constraint phase2c_projection_state_pk primary key (user_id, anilist_id),
  constraint phase2c_projection_state_coordination_fk
    foreign key (user_id, anilist_id)
    references public.phase2c_entry_coordination (user_id, anilist_id)
    on delete cascade,
  constraint phase2c_projection_state_anilist_positive check (anilist_id > 0),
  constraint phase2c_projection_state_generation_nonnegative check (generation >= 0),
  constraint phase2c_projection_state_revision_nonnegative check (projection_revision >= 0)
);

create table if not exists public.phase2c_reconciliation_issues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  anilist_id integer not null,
  issue_kind text not null,
  details jsonb not null default '{}'::jsonb,
  observed_source_revision bigint,
  observed_projection_revision bigint,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint phase2c_reconciliation_issues_anilist_positive check (anilist_id > 0),
  constraint phase2c_reconciliation_issues_source_nonnegative
    check (observed_source_revision is null or observed_source_revision >= 0),
  constraint phase2c_reconciliation_issues_projection_nonnegative
    check (observed_projection_revision is null or observed_projection_revision >= 0)
);

create index if not exists phase2c_reconciliation_issues_entry_idx
  on public.phase2c_reconciliation_issues (user_id, anilist_id, created_at desc);
create index if not exists phase2c_reconciliation_issues_unresolved_idx
  on public.phase2c_reconciliation_issues (resolved_at, created_at desc)
  where resolved_at is null;

-- All relevant control/evidence tables are protected even for table owners.
alter table public.phase2c_entry_coordination enable row level security;
alter table public.phase2c_entry_coordination force row level security;
alter table public.phase2c_projection_state enable row level security;
alter table public.phase2c_projection_state force row level security;
alter table public.phase2c_reconciliation_issues enable row level security;
alter table public.phase2c_reconciliation_issues force row level security;

revoke all on public.phase2c_entry_coordination from public, anon, authenticated, service_role;
revoke all on public.phase2c_projection_state from public, anon, authenticated, service_role;
revoke all on public.phase2c_reconciliation_issues from public, anon, authenticated, service_role;

grant select, insert, update on public.phase2c_entry_coordination to phase2c_api_owner;
grant select, insert, update on public.phase2c_projection_state to phase2c_api_owner;
grant select, insert, update on public.phase2c_reconciliation_issues to phase2c_reconcile_owner;
grant select, insert, update on public.phase2c_entry_coordination to phase2c_reconcile_owner;
grant select, insert, update on public.phase2c_projection_state to phase2c_reconcile_owner;

drop policy if exists phase2c_coordination_api_select on public.phase2c_entry_coordination;
create policy phase2c_coordination_api_select
  on public.phase2c_entry_coordination for select to phase2c_api_owner
  using ((select auth.uid()) = user_id);
drop policy if exists phase2c_coordination_api_insert on public.phase2c_entry_coordination;
create policy phase2c_coordination_api_insert
  on public.phase2c_entry_coordination for insert to phase2c_api_owner
  with check ((select auth.uid()) = user_id);
drop policy if exists phase2c_coordination_api_update on public.phase2c_entry_coordination;
create policy phase2c_coordination_api_update
  on public.phase2c_entry_coordination for update to phase2c_api_owner
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists phase2c_projection_api_select on public.phase2c_projection_state;
create policy phase2c_projection_api_select
  on public.phase2c_projection_state for select to phase2c_api_owner
  using ((select auth.uid()) = user_id);
drop policy if exists phase2c_projection_api_insert on public.phase2c_projection_state;
create policy phase2c_projection_api_insert
  on public.phase2c_projection_state for insert to phase2c_api_owner
  with check ((select auth.uid()) = user_id);
drop policy if exists phase2c_projection_api_update on public.phase2c_projection_state;
create policy phase2c_projection_api_update
  on public.phase2c_projection_state for update to phase2c_api_owner
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists phase2c_issues_reconcile_select on public.phase2c_reconciliation_issues;
create policy phase2c_issues_reconcile_select
  on public.phase2c_reconciliation_issues for select to phase2c_reconcile_owner
  using (true);
drop policy if exists phase2c_issues_reconcile_insert on public.phase2c_reconciliation_issues;
create policy phase2c_issues_reconcile_insert
  on public.phase2c_reconciliation_issues for insert to phase2c_reconcile_owner
  with check (true);
drop policy if exists phase2c_issues_reconcile_update on public.phase2c_reconciliation_issues;
create policy phase2c_issues_reconcile_update
  on public.phase2c_reconciliation_issues for update to phase2c_reconcile_owner
  using (true)
  with check (true);

-- API-owner access to legacy and canonical user projections is still own-row
-- scoped by RLS. Existing authenticated grants remain until cutover.
grant select, insert, update, delete on public.user_anime to phase2c_api_owner;
grant select on public.user_anime to phase2c_reconcile_owner;
grant select, insert, update, delete on public.user_anime_episodes to phase2c_api_owner;
grant select on public.user_anime_episodes to phase2c_reconcile_owner;
grant select, insert, update, delete on public.user_media to phase2c_api_owner, phase2c_reconcile_owner;
grant select, insert, update, delete on public.user_media_episodes to phase2c_api_owner, phase2c_reconcile_owner;
grant select on public.media_external_ids to phase2c_api_owner, phase2c_reconcile_owner;

do $$
declare
  _table text;
begin
  foreach _table in array array['user_anime', 'user_anime_episodes', 'user_media', 'user_media_episodes'] loop
    execute format('alter table public.%I enable row level security', _table);
    execute format('alter table public.%I force row level security', _table);
  end loop;
end
$$;

-- Own-row policies for the API definer. They are separate from the existing
-- authenticated policies so direct authenticated DML remains unchanged until
-- the separately approved cutover.
drop policy if exists phase2c_api_user_anime_select on public.user_anime;
create policy phase2c_api_user_anime_select on public.user_anime
  for select to phase2c_api_owner using ((select auth.uid()) = user_id);
drop policy if exists phase2c_api_user_anime_insert on public.user_anime;
create policy phase2c_api_user_anime_insert on public.user_anime
  for insert to phase2c_api_owner with check ((select auth.uid()) = user_id);
drop policy if exists phase2c_api_user_anime_update on public.user_anime;
create policy phase2c_api_user_anime_update on public.user_anime
  for update to phase2c_api_owner using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists phase2c_api_user_anime_delete on public.user_anime;
create policy phase2c_api_user_anime_delete on public.user_anime
  for delete to phase2c_api_owner using ((select auth.uid()) = user_id);

drop policy if exists phase2c_api_user_anime_episodes_select on public.user_anime_episodes;
create policy phase2c_api_user_anime_episodes_select on public.user_anime_episodes
  for select to phase2c_api_owner using ((select auth.uid()) = user_id);
drop policy if exists phase2c_api_user_anime_episodes_insert on public.user_anime_episodes;
create policy phase2c_api_user_anime_episodes_insert on public.user_anime_episodes
  for insert to phase2c_api_owner with check ((select auth.uid()) = user_id);
drop policy if exists phase2c_api_user_anime_episodes_update on public.user_anime_episodes;
create policy phase2c_api_user_anime_episodes_update on public.user_anime_episodes
  for update to phase2c_api_owner using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists phase2c_api_user_anime_episodes_delete on public.user_anime_episodes;
create policy phase2c_api_user_anime_episodes_delete on public.user_anime_episodes
  for delete to phase2c_api_owner using ((select auth.uid()) = user_id);

drop policy if exists phase2c_api_user_media_select on public.user_media;
create policy phase2c_api_user_media_select on public.user_media
  for select to phase2c_api_owner using ((select auth.uid()) = user_id);
drop policy if exists phase2c_api_user_media_insert on public.user_media;
create policy phase2c_api_user_media_insert on public.user_media
  for insert to phase2c_api_owner with check ((select auth.uid()) = user_id);
drop policy if exists phase2c_api_user_media_update on public.user_media;
create policy phase2c_api_user_media_update on public.user_media
  for update to phase2c_api_owner using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists phase2c_api_user_media_delete on public.user_media;
create policy phase2c_api_user_media_delete on public.user_media
  for delete to phase2c_api_owner using ((select auth.uid()) = user_id);

drop policy if exists phase2c_api_user_media_episodes_select on public.user_media_episodes;
create policy phase2c_api_user_media_episodes_select on public.user_media_episodes
  for select to phase2c_api_owner using ((select auth.uid()) = user_id);
drop policy if exists phase2c_api_user_media_episodes_insert on public.user_media_episodes;
create policy phase2c_api_user_media_episodes_insert on public.user_media_episodes
  for insert to phase2c_api_owner with check ((select auth.uid()) = user_id);
drop policy if exists phase2c_api_user_media_episodes_update on public.user_media_episodes;
create policy phase2c_api_user_media_episodes_update on public.user_media_episodes
  for update to phase2c_api_owner using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists phase2c_api_user_media_episodes_delete on public.user_media_episodes;
create policy phase2c_api_user_media_episodes_delete on public.user_media_episodes
  for delete to phase2c_api_owner using ((select auth.uid()) = user_id);

-- Reconciliation is cross-user SELECT on legacy state and canonical DML. It
-- has no legacy/catalogue DML and no control-row DELETE.
drop policy if exists phase2c_reconcile_legacy_select on public.user_anime;
create policy phase2c_reconcile_legacy_select on public.user_anime
  for select to phase2c_reconcile_owner using (true);
drop policy if exists phase2c_reconcile_legacy_episodes_select on public.user_anime_episodes;
create policy phase2c_reconcile_legacy_episodes_select on public.user_anime_episodes
  for select to phase2c_reconcile_owner using (true);
drop policy if exists phase2c_reconcile_user_media_select on public.user_media;
create policy phase2c_reconcile_user_media_select on public.user_media
  for select to phase2c_reconcile_owner using (true);
drop policy if exists phase2c_reconcile_user_media_insert on public.user_media;
create policy phase2c_reconcile_user_media_insert on public.user_media
  for insert to phase2c_reconcile_owner with check (true);
drop policy if exists phase2c_reconcile_user_media_update on public.user_media;
create policy phase2c_reconcile_user_media_update on public.user_media
  for update to phase2c_reconcile_owner using (true) with check (true);
drop policy if exists phase2c_reconcile_user_media_delete on public.user_media;
create policy phase2c_reconcile_user_media_delete on public.user_media
  for delete to phase2c_reconcile_owner using (true);
drop policy if exists phase2c_reconcile_user_media_episodes_select on public.user_media_episodes;
create policy phase2c_reconcile_user_media_episodes_select on public.user_media_episodes
  for select to phase2c_reconcile_owner using (true);
drop policy if exists phase2c_reconcile_user_media_episodes_insert on public.user_media_episodes;
create policy phase2c_reconcile_user_media_episodes_insert on public.user_media_episodes
  for insert to phase2c_reconcile_owner with check (true);
drop policy if exists phase2c_reconcile_user_media_episodes_update on public.user_media_episodes;
create policy phase2c_reconcile_user_media_episodes_update on public.user_media_episodes
  for update to phase2c_reconcile_owner using (true) with check (true);
drop policy if exists phase2c_reconcile_user_media_episodes_delete on public.user_media_episodes;
create policy phase2c_reconcile_user_media_episodes_delete on public.user_media_episodes
  for delete to phase2c_reconcile_owner using (true);

grant usage on schema auth to phase2c_api_owner;
grant execute on function auth.uid() to phase2c_api_owner;
grant usage on schema public to phase2c_api_owner, phase2c_reconcile_owner;

create or replace function private.phase2c_require_auth_uid()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'authenticated identity is required' using errcode = '28000';
  end if;
  return v_user_id;
end;
$$;
alter function private.phase2c_require_auth_uid() owner to phase2c_api_owner;
revoke all on function private.phase2c_require_auth_uid() from public, anon, authenticated, service_role;

create or replace function private.phase2c_projection_is_synchronized(
  p_user_id uuid,
  p_anilist_id integer
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  with legacy as (
    select * from public.user_anime
    where user_id = p_user_id and anilist_id = p_anilist_id
  ), canonical as (
    select um.* from public.user_media um
    join legacy l on l.id = um.id and um.user_id = l.user_id
  ), parent_ok as (
    select exists (
      select 1 from legacy l join canonical c on true
      where (
        (l.media_type = 'manga'
          and c.media_kind = 'manga'
          and c.chapters_read is not distinct from l.progress
          and c.volumes_read is not distinct from l.volumes_progress)
        or (l.media_type = 'anime'
          and c.media_kind = 'anime'
          and c.episodes_watched is not distinct from l.progress)
        or (l.media_type = 'anime'
          and c.media_kind = 'movie'
          and c.movie_watched is not distinct from (l.status = 'completed' or l.progress >= 1))
      )
      and c.status = l.status
      and c.score is not distinct from l.score
      and c.notes is not distinct from l.notes
      and c.started_at is not distinct from l.started_at
      and c.completed_at is not distinct from l.completed_at
      and c.favorite = false
      and c.rewatch_count = 0
    ) as ok
  ), episode_ok as (
    select (not exists (
      select 1
      from public.user_anime_episodes le
      left join public.user_media_episodes ce
        on ce.id = le.id
       and ce.user_id = le.user_id
       and ce.episode_number = le.episode_number
      where le.user_id = p_user_id
        and le.anilist_id = p_anilist_id
        and (ce.id is null or ce.watched_at is distinct from le.watched_at)
    ) and not exists (
      select 1
      from public.user_media_episodes ce
      left join public.user_anime_episodes le
        on le.id = ce.id
       and le.user_id = ce.user_id
       and le.episode_number = ce.episode_number
      join canonical c on c.id = ce.user_media_id
      where ce.user_id = p_user_id
        and c.id is not null
        and le.id is null
    )) as ok
  )
  select (select ok from parent_ok) and (select ok from episode_ok);
$$;
alter function private.phase2c_projection_is_synchronized(uuid, integer) owner to phase2c_api_owner;
revoke all on function private.phase2c_projection_is_synchronized(uuid, integer)
  from public, anon, authenticated, service_role;

create or replace function public.phase2c_read_library()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with identity as (
    select private.phase2c_require_auth_uid() as user_id
  ), base as (
    select
      ua.*,
      ec.generation,
      ec.deleted,
      ec.source_revision,
      ec.lifecycle_version,
      ec.progress_version,
      ec.score_version,
      ec.notes_version,
      ps.generation as projection_generation,
      ps.projection_revision,
      ps.projected_deleted,
      case
        when ec.user_id is null or ps.user_id is null then 'bootstrap_pending'
        when ec.deleted or ps.projected_deleted then 'degraded'
        when ec.generation <> ps.generation
          or ec.source_revision <> ps.projection_revision
          or ec.deleted <> ps.projected_deleted then 'degraded'
        when not private.phase2c_projection_is_synchronized(ua.user_id, ua.anilist_id)
          then 'degraded'
        else 'synchronized'
      end as projection_status
    from public.user_anime ua
    join identity i on i.user_id = ua.user_id
    left join public.phase2c_entry_coordination ec
      on ec.user_id = ua.user_id and ec.anilist_id = ua.anilist_id
    left join public.phase2c_projection_state ps
      on ps.user_id = ua.user_id and ps.anilist_id = ua.anilist_id
  ), entries as (
    select
      b.*,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', e.id,
          'userId', e.user_id,
          'anilistId', e.anilist_id,
          'episodeNumber', e.episode_number,
          'watchedAt', e.watched_at,
          'createdAt', e.created_at
        ) order by e.episode_number)
        from public.user_anime_episodes e
        where e.user_id = b.user_id and e.anilist_id = b.anilist_id
      ), '[]'::jsonb) as watched_episodes
    from base b
  )
  select jsonb_build_object(
    'libraryStatus', coalesce((
      select case
        when bool_or(projection_status = 'degraded') then 'degraded'
        when bool_or(projection_status = 'bootstrap_pending') then 'bootstrap_pending'
        else 'ready'
      end from entries
    ), 'ready'),
    'entries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'entry', jsonb_build_object(
          'id', id, 'userId', user_id, 'anilistId', anilist_id,
          'mediaType', media_type, 'status', status, 'progress', progress,
          'volumesProgress', volumes_progress, 'score', score,
          'startedAt', started_at, 'completedAt', completed_at,
          'notes', notes, 'createdAt', created_at, 'updatedAt', updated_at
        ),
        'cas', case when generation is null then null else jsonb_build_object(
          'generation', generation,
          'lifecycleVersion', lifecycle_version,
          'progressVersion', progress_version,
          'scoreVersion', score_version,
          'notesVersion', notes_version
        ) end,
        'watchedEpisodes', watched_episodes,
        'projectionStatus', projection_status
      ) order by updated_at desc) from entries
    ), '[]'::jsonb)
  );
$$;
alter function public.phase2c_read_library() owner to phase2c_api_owner;
revoke all on function public.phase2c_read_library() from public, anon, service_role;
grant execute on function public.phase2c_read_library() to authenticated;

create or replace function public.phase2c_read_entry_state(p_anilist_id integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with identity as (
    select private.phase2c_require_auth_uid() as user_id
  ), state as (
    select
      i.user_id,
      i.user_id is not null as has_identity,
      ua.id is not null as has_legacy,
      ec.*,
      ps.generation as projection_generation,
      ps.projection_revision,
      ps.projected_deleted,
      private.phase2c_projection_is_synchronized(i.user_id, p_anilist_id) as content_ok
    from identity i
    left join public.user_anime ua
      on ua.user_id = i.user_id and ua.anilist_id = p_anilist_id
    left join public.phase2c_entry_coordination ec
      on ec.user_id = i.user_id and ec.anilist_id = p_anilist_id
    left join public.phase2c_projection_state ps
      on ps.user_id = i.user_id and ps.anilist_id = p_anilist_id
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'status', case
      when not has_legacy and generation is null then 'never_seen'
      when generation is null or projection_generation is null then 'bootstrap_pending'
      when deleted and not has_legacy and projected_deleted then 'deleted'
      when deleted or projected_deleted or generation <> projection_generation
        or source_revision <> projection_revision or not content_ok then 'degraded'
      else 'live'
    end,
    'cas', case when generation is null then null else jsonb_build_object(
      'generation', generation,
      'lifecycleVersion', lifecycle_version,
      'progressVersion', progress_version,
      'scoreVersion', score_version,
      'notesVersion', notes_version
    ) end,
    'deletedGeneration', case when deleted then generation else null end
  ))
  from state;
$$;
alter function public.phase2c_read_entry_state(integer) owner to phase2c_api_owner;
revoke all on function public.phase2c_read_entry_state(integer) from public, anon, service_role;
grant execute on function public.phase2c_read_entry_state(integer) to authenticated;

comment on table public.phase2c_entry_coordination is
  'Durable per-user AniList generation, source revision, field versions, and tombstone state.';
comment on table public.phase2c_projection_state is
  'Durable canonical projection generation, revision, and tombstone state.';
comment on table public.phase2c_reconciliation_issues is
  'Service-only durable mismatch and quarantine evidence; unresolved rows are never silently discarded.';
