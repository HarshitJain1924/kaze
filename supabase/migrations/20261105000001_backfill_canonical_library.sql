-- Phase 2B: idempotent AniList library backfill.
--
-- The legacy tables remain authoritative. This function only inserts missing
-- canonical rows, mappings and episode history. Re-running it does not update
-- an existing user_media row, so a partial canonical edit is not overwritten by
-- a stale legacy row. Invalid or conflicting legacy rows are quarantined in
-- media_backfill_issues instead of being guessed or silently dropped.

create or replace function public.deterministic_anilist_media_id(
  p_anilist_id integer
)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_anilist_id is null or p_anilist_id <= 0 then null
    else (
      substr(md5('kaze:anilist:' || p_anilist_id::text), 1, 8) || '-' ||
      substr(md5('kaze:anilist:' || p_anilist_id::text), 9, 4) || '-5' ||
      substr(md5('kaze:anilist:' || p_anilist_id::text), 14, 3) || '-8' ||
      substr(md5('kaze:anilist:' || p_anilist_id::text), 18, 3) || '-' ||
      substr(md5('kaze:anilist:' || p_anilist_id::text), 21, 12)
    )::uuid
  end
$$;

comment on function public.deterministic_anilist_media_id(integer) is
  'Deterministic migration-only UUID for a legacy AniList media ID. Provider IDs remain external references, never canonical keys in application code.';

create or replace function public.backfill_phase2b(
  p_run_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_media_inserted bigint := 0;
  v_mappings_inserted bigint := 0;
  v_user_media_inserted bigint := 0;
  v_episodes_inserted bigint := 0;
  v_issues bigint := 0;
begin
  -- Defensive validation. The legacy constraints normally make these
  -- conditions impossible, but a migration must not assume that they held
  -- during every historical write.
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    ua.id::text,
    'invalid-legacy-id',
    jsonb_build_object('anilistId', ua.anilist_id)
  from public.user_anime ua
  where ua.anilist_id is null or ua.anilist_id <= 0
  on conflict do nothing;

  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    ua.id::text,
    'invalid-media-type',
    jsonb_build_object('mediaType', ua.media_type)
  from public.user_anime ua
  where ua.media_type is null
     or ua.media_type not in ('anime', 'manga')
  on conflict do nothing;

  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    ua.id::text,
    'invalid-status',
    jsonb_build_object('status', ua.status)
  from public.user_anime ua
  where ua.status is null
     or ua.status not in ('watching', 'completed', 'planning', 'on_hold', 'dropped')
  on conflict do nothing;

  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    ua.id::text,
    'invalid-progress',
    jsonb_build_object(
      'progress', ua.progress,
      'volumesProgress', ua.volumes_progress
    )
  from public.user_anime ua
  where ua.progress is null
     or ua.progress < 0
     or ua.volumes_progress is null
     or ua.volumes_progress < 0
     or (ua.media_type = 'anime' and ua.volumes_progress <> 0)
  on conflict do nothing;

  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    ua.id::text,
    'invalid-score',
    jsonb_build_object('score', ua.score)
  from public.user_anime ua
  where ua.score is not null
     and (ua.score < 1 or ua.score > 10)
  on conflict do nothing;

  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    ua.id::text,
    'invalid-notes',
    jsonb_build_object('notesLength', char_length(ua.notes))
  from public.user_anime ua
  where ua.notes is not null and char_length(ua.notes) > 5000
  on conflict do nothing;

  -- One AniList ID must not be both anime and manga. Quarantine every affected
  -- library row rather than choosing a kind arbitrarily.
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    ua.id::text,
    'conflicting-media-kind',
    jsonb_build_object('anilistId', ua.anilist_id)
  from public.user_anime ua
  where exists (
    select 1
    from public.user_anime other
    where other.anilist_id = ua.anilist_id
      and other.media_type <> ua.media_type
  )
  on conflict do nothing;

  -- Existing external-ID mappings are authoritative. Never retarget one to a
  -- different canonical media row during a rerun.
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    ua.id::text,
    'conflicting-provider-mapping',
    jsonb_build_object(
      'anilistId', ua.anilist_id,
      'existingMediaId', mei.media_id
    )
  from public.user_anime ua
  join public.media_external_ids mei
    on mei.provider = 'anilist'
   and mei.external_id = ua.anilist_id::text
  where mei.media_id <> public.deterministic_anilist_media_id(ua.anilist_id)
  on conflict do nothing;

  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    ua.id::text,
    'conflicting-media-kind-existing',
    jsonb_build_object(
      'anilistId', ua.anilist_id,
      'existingKind', m.kind
    )
  from public.user_anime ua
  join public.media m
    on m.id = public.deterministic_anilist_media_id(ua.anilist_id)
  where m.kind <> case ua.media_type
    when 'manga' then 'manga'
    else 'anime'
  end
  on conflict do nothing;

  -- Valid legacy rows for this run. Every later insert uses this snapshot so
  -- the same exclusions apply consistently.
  drop table if exists pg_temp.phase2b_valid_legacy;
  create temporary table pg_temp.phase2b_valid_legacy
  on commit drop
  as
  select
    ua.id,
    ua.user_id,
    ua.anilist_id,
    public.deterministic_anilist_media_id(ua.anilist_id) as media_id,
    case ua.media_type
      when 'manga' then 'manga'
      else 'anime'
    end as media_kind,
    ua.status,
    ua.progress,
    ua.volumes_progress,
    ua.score,
    ua.started_at,
    ua.completed_at,
    ua.notes,
    ua.created_at,
    ua.updated_at
  from public.user_anime ua
  where ua.anilist_id > 0
    and ua.media_type in ('anime', 'manga')
    and ua.status in ('watching', 'completed', 'planning', 'on_hold', 'dropped')
    and ua.progress >= 0
    and ua.volumes_progress >= 0
    and (ua.media_type = 'manga' or ua.volumes_progress = 0)
    and (ua.score is null or ua.score between 1 and 10)
    and (ua.notes is null or char_length(ua.notes) <= 5000)
    and not exists (
      select 1
      from public.user_anime other
      where other.anilist_id = ua.anilist_id
        and other.media_type <> ua.media_type
    )
    and not exists (
      select 1
      from public.media_external_ids mei
      where mei.provider = 'anilist'
        and mei.external_id = ua.anilist_id::text
        and mei.media_id <> public.deterministic_anilist_media_id(ua.anilist_id)
    )
    and not exists (
      select 1
      from public.media m
      where m.id = public.deterministic_anilist_media_id(ua.anilist_id)
        and m.kind <> case ua.media_type
          when 'manga' then 'manga'
          else 'anime'
        end
    );

  insert into public.media (id, kind)
  select media_id, media_kind
  from pg_temp.phase2b_valid_legacy
  on conflict do nothing;
  get diagnostics v_media_inserted = row_count;

  insert into public.media_external_ids (media_id, provider, external_id)
  select media_id, 'anilist', anilist_id::text
  from pg_temp.phase2b_valid_legacy
  on conflict do nothing;
  get diagnostics v_mappings_inserted = row_count;

  insert into public.user_media (
    id,
    user_id,
    media_id,
    media_kind,
    status,
    episodes_watched,
    chapters_read,
    volumes_read,
    movie_watched,
    tv_season_number,
    tv_episode_number,
    tv_episodes_watched,
    score,
    favorite,
    notes,
    rewatch_count,
    started_at,
    completed_at,
    created_at,
    updated_at
  )
  select
    id,
    user_id,
    media_id,
    media_kind,
    status,
    case when media_kind = 'anime' then progress else null end,
    case when media_kind = 'manga' then progress else null end,
    case when media_kind = 'manga' then volumes_progress else null end,
    null,
    null,
    null,
    null,
    score,
    false,
    notes,
    0,
    started_at,
    completed_at,
    created_at,
    updated_at
  from pg_temp.phase2b_valid_legacy
  on conflict do nothing;
  get diagnostics v_user_media_inserted = row_count;

  -- Episode records are anime-only in the legacy model. Legacy rows have no
  -- season column, so season_number = 0 is the explicit compatibility
  -- convention; it is not an assertion that the episode belongs to TV season 0.
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime_episodes',
    e.id::text,
    'orphan-episode',
    jsonb_build_object('userId', e.user_id, 'anilistId', e.anilist_id)
  from public.user_anime_episodes e
  where not exists (
    select 1
    from public.user_anime ua
    where ua.user_id = e.user_id
      and ua.anilist_id = e.anilist_id
  )
  on conflict do nothing;

  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime_episodes',
    e.id::text,
    'manga-episode-history',
    jsonb_build_object('anilistId', e.anilist_id)
  from public.user_anime_episodes e
  join public.user_anime ua
    on ua.user_id = e.user_id
   and ua.anilist_id = e.anilist_id
  where ua.media_type = 'manga'
  on conflict do nothing;

  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime_episodes',
    e.id::text,
    'episode-parent-not-migrated',
    jsonb_build_object('anilistId', e.anilist_id)
  from public.user_anime_episodes e
  join public.user_anime ua
    on ua.user_id = e.user_id
   and ua.anilist_id = e.anilist_id
  where not exists (
    select 1
    from pg_temp.phase2b_valid_legacy vl
    where vl.user_id = e.user_id
      and vl.anilist_id = e.anilist_id
  )
  on conflict do nothing;

  drop table if exists pg_temp.phase2b_valid_episodes;
  create temporary table pg_temp.phase2b_valid_episodes
  on commit drop
  as
  select
    e.id,
    e.user_id,
    vl.id as user_media_id,
    e.episode_number,
    e.watched_at,
    e.created_at
  from public.user_anime_episodes e
  join pg_temp.phase2b_valid_legacy vl
    on vl.user_id = e.user_id
   and vl.anilist_id = e.anilist_id
  where e.episode_number > 0;

  insert into public.user_media_episodes (
    id,
    user_id,
    user_media_id,
    season_number,
    episode_number,
    watched_at,
    created_at
  )
  select
    id,
    user_id,
    user_media_id,
    0,
    episode_number,
    watched_at,
    created_at
  from pg_temp.phase2b_valid_episodes
  on conflict do nothing;
  get diagnostics v_episodes_inserted = row_count;

  select count(*)
  into v_issues
  from public.media_backfill_issues
  where run_id = p_run_id;

  return jsonb_build_object(
    'run_id', p_run_id,
    'media_inserted', v_media_inserted,
    'external_ids_inserted', v_mappings_inserted,
    'user_media_inserted', v_user_media_inserted,
    'episodes_inserted', v_episodes_inserted,
    'issues', v_issues
  );
end;
$$;

comment on function public.backfill_phase2b(uuid) is
  'Idempotently backfills legacy AniList library rows into the additive canonical tables. Legacy tables are never modified by this function.';

grant execute on function public.deterministic_anilist_media_id(integer)
  to service_role;
grant execute on function public.backfill_phase2b(uuid)
  to service_role;

-- Run once as part of the additive migration. Re-running the function with a
-- new run id only inserts missing rows; it does not overwrite migrated data.
select public.backfill_phase2b();

create or replace function public.validate_phase2b()
returns jsonb
language sql
stable
set search_path = ''
as $$
  with progress_shape as (
    select
      (media_kind = 'anime'
        and episodes_watched is not null
        and chapters_read is null
        and volumes_read is null
        and movie_watched is null
        and tv_season_number is null
        and tv_episode_number is null
        and tv_episodes_watched is null)
      or (media_kind = 'manga'
        and episodes_watched is null
        and chapters_read is not null
        and volumes_read is not null
        and movie_watched is null
        and tv_season_number is null
        and tv_episode_number is null
        and tv_episodes_watched is null)
      or (media_kind = 'movie'
        and episodes_watched is null
        and chapters_read is null
        and volumes_read is null
        and movie_watched is not null
        and tv_season_number is null
        and tv_episode_number is null
        and tv_episodes_watched is null)
      or (media_kind = 'tv'
        and episodes_watched is null
        and chapters_read is null
        and volumes_read is null
        and movie_watched is null
        and tv_season_number is not null
        and tv_episode_number is not null
        and tv_episodes_watched is not null) as valid
    from public.user_media
  ),
  per_user_counts as (
    select
      coalesce(l.user_id, n.user_id) as user_id,
      coalesce(l.count, 0) as legacy_count,
      coalesce(n.count, 0) as canonical_count
    from (
      select user_id, count(*) as count
      from public.user_anime
      group by user_id
    ) l
    full join (
      select user_id, count(*) as count
      from public.user_media
      group by user_id
    ) n using (user_id)
  )
  select jsonb_build_object(
    'legacy_user_anime', (select count(*) from public.user_anime),
    'canonical_user_media', (select count(*) from public.user_media),
    'legacy_user_anime_episodes', (select count(*) from public.user_anime_episodes),
    'canonical_user_media_episodes', (select count(*) from public.user_media_episodes),
    'media_rows', (select count(*) from public.media),
    'external_id_rows', (select count(*) from public.media_external_ids),
    'duplicate_external_id_groups', (
      select count(*)
      from (
        select provider, external_id
        from public.media_external_ids
        group by provider, external_id
        having count(*) > 1
      ) duplicate_groups
    ),
    'missing_media_fk', (
      select count(*)
      from public.user_media um
      left join public.media m
        on m.id = um.media_id
       and m.kind = um.media_kind
      where m.id is null
    ),
    'invalid_progress_rows', (
      select count(*) from progress_shape where not valid
    ),
    'orphan_canonical_episodes', (
      select count(*)
      from public.user_media_episodes me
      left join public.user_media um
        on um.id = me.user_media_id
       and um.user_id = me.user_id
      where um.id is null
    ),
    'legacy_episode_ids_missing_from_canonical', (
      select count(*)
      from public.user_anime_episodes le
      left join public.user_media_episodes me on me.id = le.id
      where me.id is null
    ),
    'legacy_library_ids_missing_from_canonical', (
      select count(*)
      from public.user_anime la
      left join public.user_media um on um.id = la.id
      where um.id is null
    ),
    'per_user_count_mismatches', (
      select count(*)
      from per_user_counts
      where legacy_count <> canonical_count
    ),
    'backfill_issues', (select count(*) from public.media_backfill_issues)
  )
$$;

comment on function public.validate_phase2b() is
  'Read-only validation snapshot for the Phase 2B canonical backfill. Non-zero mismatch/issue counts require review; this function does not delete or repair data.';

grant execute on function public.validate_phase2b()
  to service_role;
