-- Phase 2B: idempotent AniList library backfill.
--
-- The legacy tables remain authoritative. This function only inserts missing
-- canonical rows, mappings and episode history. Re-running it does not update
-- an existing user_media row, so a partial canonical edit is not overwritten by
-- a stale legacy row. Invalid or conflicting legacy rows are quarantined in
-- media_backfill_issues instead of being guessed or silently dropped.
--
-- Classification:
--   - AniList manga -> 'manga'
--   - AniList anime with format 'MOVIE' in catalog_cache -> 'movie'
--   - AniList anime with series/TV formats in catalog_cache -> 'anime'
--   - Missing, malformed, or conflicting cache format -> quarantined in media_backfill_issues

-- Standard RFC 4122 UUIDv3 deterministic generator using the standard URL namespace:
-- Namespace: 6ba7b811-9dad-11d1-80b4-00c04fd430c8
-- Name: 'kaze:anilist:' || p_anilist_id::text
-- Zero external extension dependencies: uses PostgreSQL core md5(bytea), decode, and bit operations.
create or replace function public.deterministic_anilist_media_id(
  p_anilist_id integer
)
returns uuid
language sql
immutable
set search_path = ''
as $$
  with hash_calc as (
    select md5(
      decode('6ba7b8119dad11d180b400c04fd430c8', 'hex') ||
      convert_to('kaze:anilist:' || p_anilist_id::text, 'UTF8')
    ) as h
  )
  select case
    when p_anilist_id is null or p_anilist_id <= 0 then null
    else (
      substr(h, 1, 8) || '-' ||
      substr(h, 9, 4) || '-3' ||
      substr(h, 14, 3) || '-' ||
      to_hex((('x' || substr(h, 17, 2))::bit(8) & B'00111111' | B'10000000')::integer) ||
      substr(h, 19, 2) || '-' ||
      substr(h, 21, 12)
    )::uuid
  end
  from hash_calc;
$$;

comment on function public.deterministic_anilist_media_id(integer) is
  'Deterministic RFC 4122 UUIDv3 migration lookup key for legacy AniList media IDs using standard namespace 6ba7b811-9dad-11d1-80b4-00c04fd430c8. Zero-dependency implementation.';

create or replace function public.backfill_phase2b(
  p_run_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_existing_outcome text;
  v_media_inserted bigint := 0;
  v_mappings_inserted bigint := 0;
  v_user_media_inserted bigint := 0;
  v_episodes_inserted bigint := 0;
  v_issues bigint := 0;
begin
  -- 0. Check or initialize run in media_backfill_runs ledger
  -- Lock any existing run row to prevent concurrent race conditions.
  select outcome into v_existing_outcome
  from public.media_backfill_runs
  where id = p_run_id
  for update;

  if v_existing_outcome is not null then
    if v_existing_outcome = 'completed' then
      raise exception 'Run ID % has already completed and cannot be reused.', p_run_id
        using errcode = 'check_violation';
    elsif v_existing_outcome = 'failed' then
      raise exception 'Run ID % has already failed and cannot be reused. Retries must use a new run ID.', p_run_id
        using errcode = 'check_violation';
    end if;
    -- outcome is 'running': pre-registered by external orchestrator, proceed with backfill
  else
    insert into public.media_backfill_runs (id, started_at, outcome)
    values (p_run_id, clock_timestamp(), 'running');
  end if;

  -- 1. Extract and aggregate format information from public.catalog_cache
  drop table if exists pg_temp.phase2b_cache_format;
  create temporary table pg_temp.phase2b_cache_format
  on commit drop
  as
  select
    c_id as anilist_id,
    count(*) as total_entries,
    count(*) filter (where payload_is_object and has_nonempty_format and format_is_valid) as valid_entries,
    count(*) filter (where not payload_is_object) as malformed_payload_entries,
    count(*) filter (where payload_is_object and not has_nonempty_format) as missing_format_entries,
    count(*) filter (where payload_is_object and has_nonempty_format and not format_is_valid) as invalid_format_entries,
    count(distinct cleaned_format) filter (where payload_is_object and has_nonempty_format and format_is_valid) as distinct_valid_formats,
    max(cleaned_format) filter (where payload_is_object and has_nonempty_format and format_is_valid) as resolved_format
  from (
    select
      (regexp_match(c.key, '^(?:details|summary):([0-9]+)$'))[1]::integer as c_id,
      (c.payload is not null and jsonb_typeof(c.payload) = 'object') as payload_is_object,
      (c.payload is not null and jsonb_typeof(c.payload) = 'object' and c.payload ? 'format' and c.payload->>'format' is not null and trim(c.payload->>'format') <> '') as has_nonempty_format,
      upper(trim(c.payload->>'format')) as cleaned_format,
      (upper(trim(c.payload->>'format')) in ('MOVIE', 'TV', 'TV_SHORT', 'OVA', 'ONA', 'SPECIAL', 'MUSIC', 'MANGA', 'ONE_SHOT', 'NOVEL')) as format_is_valid
    from public.catalog_cache c
    where c.key ~ '^(?:details|summary):[0-9]+$'
  ) sub
  where c_id is not null
  group by c_id;

  -- 2. Defensive validation of legacy records
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
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

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
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

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
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

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
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

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
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

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
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- 3. Inconsistency in legacy table: same anilist_id mapped as both anime and manga
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
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- 4. AniList Anime format resolution and cache diagnostics
  -- Missing cache: Cannot determine format (movie vs series) without guessing
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    ua.id::text,
    'missing-catalog-cache',
    jsonb_build_object('anilistId', ua.anilist_id, 'mediaType', ua.media_type)
  from public.user_anime ua
  left join pg_temp.phase2b_cache_format cf on cf.anilist_id = ua.anilist_id
  where ua.media_type = 'anime'
    and (cf.anilist_id is null or cf.total_entries = 0)
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Malformed cache: Payload missing format, unrecognised format, or mixed valid/malformed entries
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    ua.id::text,
    'malformed-catalog-cache',
    jsonb_build_object(
      'anilistId', ua.anilist_id,
      'totalEntries', cf.total_entries,
      'malformedPayloadEntries', cf.malformed_payload_entries,
      'missingFormatEntries', cf.missing_format_entries,
      'invalidFormatEntries', cf.invalid_format_entries,
      'resolvedFormat', cf.resolved_format
    )
  from public.user_anime ua
  join pg_temp.phase2b_cache_format cf on cf.anilist_id = ua.anilist_id
  where ua.media_type = 'anime'
    and (
      cf.malformed_payload_entries > 0
      or cf.missing_format_entries > 0
      or cf.invalid_format_entries > 0
      or cf.valid_entries = 0
    )
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Conflicting cache metadata for the same anime: multiple distinct valid formats
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    ua.id::text,
    'conflicting-catalog-cache',
    jsonb_build_object(
      'anilistId', ua.anilist_id,
      'distinctFormats', cf.distinct_valid_formats
    )
  from public.user_anime ua
  join pg_temp.phase2b_cache_format cf on cf.anilist_id = ua.anilist_id
  where ua.media_type = 'anime'
    and cf.distinct_valid_formats > 1
    and cf.malformed_payload_entries = 0
    and cf.missing_format_entries = 0
    and cf.invalid_format_entries = 0
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Conflicting media kind in cache: Legacy says anime but cache says comic/manga format
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    ua.id::text,
    'conflicting-media-kind-cache',
    jsonb_build_object(
      'anilistId', ua.anilist_id,
      'legacyType', 'anime',
      'cachedFormat', cf.resolved_format
    )
  from public.user_anime ua
  join pg_temp.phase2b_cache_format cf on cf.anilist_id = ua.anilist_id
  where ua.media_type = 'anime'
    and cf.distinct_valid_formats = 1
    and cf.malformed_payload_entries = 0
    and cf.missing_format_entries = 0
    and cf.invalid_format_entries = 0
    and cf.resolved_format in ('MANGA', 'ONE_SHOT', 'NOVEL')
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Manga conflict: Legacy says manga but cache says movie or anime
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    ua.id::text,
    'conflicting-media-kind-cache',
    jsonb_build_object(
      'anilistId', ua.anilist_id,
      'legacyType', 'manga',
      'cachedFormat', cf.resolved_format
    )
  from public.user_anime ua
  join pg_temp.phase2b_cache_format cf on cf.anilist_id = ua.anilist_id
  where ua.media_type = 'manga'
    and cf.resolved_format in ('MOVIE', 'TV', 'TV_SHORT', 'OVA', 'ONA', 'SPECIAL', 'MUSIC')
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- 5. Build snapshot of valid legacy rows that can be safely classified
  drop table if exists pg_temp.phase2b_valid_legacy;
  create temporary table pg_temp.phase2b_valid_legacy
  on commit drop
  as
  select
    ua.id,
    ua.user_id,
    ua.anilist_id,
    public.deterministic_anilist_media_id(ua.anilist_id) as media_id,
    case
      when ua.media_type = 'manga' then 'manga'
      when cf.resolved_format = 'MOVIE' then 'movie'
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
  left join pg_temp.phase2b_cache_format cf on cf.anilist_id = ua.anilist_id
  where ua.anilist_id > 0
    and ua.media_type in ('anime', 'manga')
    and ua.status in ('watching', 'completed', 'planning', 'on_hold', 'dropped')
    and ua.progress >= 0
    and ua.volumes_progress >= 0
    and (ua.media_type = 'manga' or ua.volumes_progress = 0)
    and (ua.score is null or ua.score between 1 and 10)
    and (ua.notes is null or char_length(ua.notes) <= 5000)
    and (
      (
        ua.media_type = 'manga'
        and (
          cf.resolved_format is null
          or cf.resolved_format not in ('MOVIE', 'TV', 'TV_SHORT', 'OVA', 'ONA', 'SPECIAL', 'MUSIC')
        )
      )
      or (
        ua.media_type = 'anime'
        and cf.anilist_id is not null
        and cf.total_entries > 0
        and cf.malformed_payload_entries = 0
        and cf.missing_format_entries = 0
        and cf.invalid_format_entries = 0
        and cf.distinct_valid_formats = 1
        and cf.resolved_format in ('MOVIE', 'TV', 'TV_SHORT', 'OVA', 'ONA', 'SPECIAL', 'MUSIC')
      )
    )
    and not exists (
      select 1
      from public.user_anime other
      where other.anilist_id = ua.anilist_id
        and other.media_type <> ua.media_type
    );

  -- 6. Strict conflict detection against existing destination tables
  -- A. Canonical media conflict: existing row has different kind
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    vl.id::text,
    'conflicting-canonical-media-kind',
    jsonb_build_object(
      'anilistId', vl.anilist_id,
      'mediaId', m.id,
      'existingKind', m.kind,
      'attemptedKind', vl.media_kind
    )
  from pg_temp.phase2b_valid_legacy vl
  join public.media m on m.id = vl.media_id
  where m.kind <> vl.media_kind
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- B. Provider mapping conflict: existing mapping points to different media_id
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    vl.id::text,
    'conflicting-provider-mapping',
    jsonb_build_object(
      'anilistId', vl.anilist_id,
      'provider', 'anilist',
      'existingMediaId', mei.media_id,
      'attemptedMediaId', vl.media_id
    )
  from pg_temp.phase2b_valid_legacy vl
  join public.media_external_ids mei
    on mei.provider = 'anilist'
   and mei.external_id = vl.anilist_id::text
  where mei.media_id <> vl.media_id
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- C. User library conflicts
  -- Existing library entry with conflicting user ownership
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    vl.id::text,
    'conflicting-library-user-ownership',
    jsonb_build_object(
      'libraryId', um.id,
      'existingUserId', um.user_id,
      'attemptedUserId', vl.user_id
    )
  from pg_temp.phase2b_valid_legacy vl
  join public.user_media um on um.id = vl.id
  where um.user_id <> vl.user_id
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Existing library entry with conflicting media ID
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    vl.id::text,
    'conflicting-library-media-id',
    jsonb_build_object(
      'libraryId', um.id,
      'existingMediaId', um.media_id,
      'attemptedMediaId', vl.media_id
    )
  from pg_temp.phase2b_valid_legacy vl
  join public.user_media um on um.id = vl.id
  where um.media_id <> vl.media_id
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Existing library entry with conflicting media kind
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    vl.id::text,
    'conflicting-library-media-kind',
    jsonb_build_object(
      'libraryId', um.id,
      'existingMediaKind', um.media_kind,
      'attemptedMediaKind', vl.media_kind
    )
  from pg_temp.phase2b_valid_legacy vl
  join public.user_media um on um.id = vl.id
  where um.media_kind <> vl.media_kind
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Existing library entry with conflicting progress
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    vl.id::text,
    'conflicting-library-progress',
    jsonb_build_object(
      'libraryId', um.id,
      'mediaKind', vl.media_kind,
      'existingEpisodes', um.episodes_watched,
      'attemptedEpisodes', (case when vl.media_kind = 'anime' then vl.progress else null end),
      'existingChapters', um.chapters_read,
      'attemptedChapters', (case when vl.media_kind = 'manga' then vl.progress else null end),
      'existingVolumes', um.volumes_read,
      'attemptedVolumes', (case when vl.media_kind = 'manga' then vl.volumes_progress else null end),
      'existingMovieWatched', um.movie_watched,
      'attemptedMovieWatched', (case when vl.media_kind = 'movie' then (vl.status = 'completed' or vl.progress >= 1) else null end)
    )
  from pg_temp.phase2b_valid_legacy vl
  join public.user_media um on um.id = vl.id
  where (
    (vl.media_kind = 'anime' and um.episodes_watched is distinct from vl.progress)
    or (vl.media_kind = 'manga' and (um.chapters_read is distinct from vl.progress or um.volumes_read is distinct from vl.volumes_progress))
    or (vl.media_kind = 'movie' and um.movie_watched is distinct from (vl.status = 'completed' or vl.progress >= 1))
  )
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Existing library entry with conflicting status
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    vl.id::text,
    'conflicting-library-status',
    jsonb_build_object(
      'libraryId', um.id,
      'existingStatus', um.status,
      'attemptedStatus', vl.status
    )
  from pg_temp.phase2b_valid_legacy vl
  join public.user_media um on um.id = vl.id
  where um.status <> vl.status
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Existing library entry with conflicting score
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    vl.id::text,
    'conflicting-library-score',
    jsonb_build_object(
      'libraryId', um.id,
      'existingScore', um.score,
      'attemptedScore', vl.score
    )
  from pg_temp.phase2b_valid_legacy vl
  join public.user_media um on um.id = vl.id
  where um.score is distinct from vl.score
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Existing library entry with conflicting notes
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    vl.id::text,
    'conflicting-library-notes',
    jsonb_build_object(
      'libraryId', um.id,
      'existingNotes', um.notes,
      'attemptedNotes', vl.notes
    )
  from pg_temp.phase2b_valid_legacy vl
  join public.user_media um on um.id = vl.id
  where um.notes is distinct from vl.notes
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Existing library entry with conflicting favorite or rewatch count
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    vl.id::text,
    'conflicting-library-favorite',
    jsonb_build_object(
      'libraryId', um.id,
      'existingFavorite', um.favorite,
      'existingRewatchCount', um.rewatch_count
    )
  from pg_temp.phase2b_valid_legacy vl
  join public.user_media um on um.id = vl.id
  where um.favorite is distinct from false
     or um.rewatch_count is distinct from 0
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Existing library entry with conflicting started/completed dates
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    vl.id::text,
    'conflicting-library-dates',
    jsonb_build_object(
      'libraryId', um.id,
      'existingStartedAt', um.started_at,
      'attemptedStartedAt', vl.started_at,
      'existingCompletedAt', um.completed_at,
      'attemptedCompletedAt', vl.completed_at
    )
  from pg_temp.phase2b_valid_legacy vl
  join public.user_media um on um.id = vl.id
  where um.started_at is distinct from vl.started_at
     or um.completed_at is distinct from vl.completed_at
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Existing library entry with conflicting created/updated timestamps
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    vl.id::text,
    'conflicting-library-timestamps',
    jsonb_build_object(
      'libraryId', um.id,
      'existingCreatedAt', um.created_at,
      'attemptedCreatedAt', vl.created_at,
      'existingUpdatedAt', um.updated_at,
      'attemptedUpdatedAt', vl.updated_at
    )
  from pg_temp.phase2b_valid_legacy vl
  join public.user_media um on um.id = vl.id
  where um.created_at is distinct from vl.created_at
     or um.updated_at is distinct from vl.updated_at
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Alternate unique key (user_id, media_id) conflict with different primary ID (conflicting fields)
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime',
    vl.id::text,
    'conflicting-alternate-key-library',
    jsonb_build_object(
      'libraryId', vl.id,
      'existingId', um.id,
      'userId', vl.user_id,
      'mediaId', vl.media_id,
      'existingStatus', um.status,
      'attemptedStatus', vl.status
    )
  from pg_temp.phase2b_valid_legacy vl
  join public.user_media um
    on um.user_id = vl.user_id
   and um.media_id = vl.media_id
   and um.id <> vl.id
  where um.media_kind <> vl.media_kind
     or um.status <> vl.status
     or (vl.media_kind = 'anime' and um.episodes_watched is distinct from vl.progress)
     or (vl.media_kind = 'manga' and (um.chapters_read is distinct from vl.progress or um.volumes_read is distinct from vl.volumes_progress))
     or (vl.media_kind = 'movie' and um.movie_watched is distinct from (vl.status = 'completed' or vl.progress >= 1))
     or um.score is distinct from vl.score
     or um.notes is distinct from vl.notes
     or um.favorite is distinct from false
     or um.rewatch_count is distinct from 0
     or um.started_at is distinct from vl.started_at
     or um.completed_at is distinct from vl.completed_at
     or um.created_at is distinct from vl.created_at
     or um.updated_at is distinct from vl.updated_at
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- 7. Execute inserts for valid, non-conflicting rows
  -- A. Insert canonical media
  insert into public.media (id, kind)
  select distinct vl.media_id, vl.media_kind
  from pg_temp.phase2b_valid_legacy vl
  where not exists (
    select 1 from public.media m where m.id = vl.media_id
  )
  and not exists (
    select 1 from public.media_backfill_issues bi
    where bi.run_id = p_run_id
      and bi.legacy_id = vl.id::text
      and bi.reason in ('conflicting-canonical-media-kind', 'conflicting-provider-mapping')
  );
  get diagnostics v_media_inserted = row_count;

  -- B. Insert provider external IDs
  insert into public.media_external_ids (media_id, provider, external_id)
  select distinct vl.media_id, 'anilist', vl.anilist_id::text
  from pg_temp.phase2b_valid_legacy vl
  where not exists (
    select 1 from public.media_external_ids mei
    where mei.provider = 'anilist' and mei.external_id = vl.anilist_id::text
  )
  and not exists (
    select 1 from public.media_backfill_issues bi
    where bi.run_id = p_run_id
      and bi.legacy_id = vl.id::text
      and bi.reason in ('conflicting-canonical-media-kind', 'conflicting-provider-mapping')
  );
  get diagnostics v_mappings_inserted = row_count;

  -- C. Insert user media
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
    vl.id,
    vl.user_id,
    vl.media_id,
    vl.media_kind,
    vl.status,
    case when vl.media_kind = 'anime' then vl.progress else null end,
    case when vl.media_kind = 'manga' then vl.progress else null end,
    case when vl.media_kind = 'manga' then vl.volumes_progress else null end,
    case when vl.media_kind = 'movie' then (vl.status = 'completed' or vl.progress >= 1) else null end,
    null,
    null,
    null,
    vl.score,
    false,
    vl.notes,
    0,
    vl.started_at,
    vl.completed_at,
    vl.created_at,
    vl.updated_at
  from pg_temp.phase2b_valid_legacy vl
  where not exists (
    select 1 from public.user_media um
    where um.id = vl.id or (um.user_id = vl.user_id and um.media_id = vl.media_id)
  )
  and not exists (
    select 1 from public.media_backfill_issues bi
    where bi.run_id = p_run_id
      and bi.legacy_id = vl.id::text
  );
  get diagnostics v_user_media_inserted = row_count;

  -- 8. Episode history migration and conflict handling
  -- Orphan episodes: parent row does not exist in user_anime
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
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Manga episode history: manga cannot carry episode progress
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
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Movie episode history: movies cannot carry episode progress
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime_episodes',
    e.id::text,
    'movie-episode-history',
    jsonb_build_object('anilistId', e.anilist_id)
  from public.user_anime_episodes e
  join pg_temp.phase2b_valid_legacy vl
    on vl.user_id = e.user_id
   and vl.anilist_id = e.anilist_id
  where vl.media_kind = 'movie'
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Parent not migrated (quarantined or missing)
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
  where ua.media_type = 'anime'
    and not exists (
      select 1
      from pg_temp.phase2b_valid_legacy vl
      join public.user_media um on (um.id = vl.id or (um.user_id = vl.user_id and um.media_id = vl.media_id))
      where vl.user_id = e.user_id
        and vl.anilist_id = e.anilist_id
        and vl.media_kind = 'anime'
    )
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Episode conflicts against existing destination records
  -- Existing episode with different parent user_media_id
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime_episodes',
    e.id::text,
    'conflicting-episode-parent',
    jsonb_build_object(
      'episodeId', ume.id,
      'existingUserMediaId', ume.user_media_id,
      'attemptedUserMediaId', um.id
    )
  from public.user_anime_episodes e
  join pg_temp.phase2b_valid_legacy vl
    on vl.user_id = e.user_id
   and vl.anilist_id = e.anilist_id
  join public.user_media um
    on um.id = vl.id or (um.user_id = vl.user_id and um.media_id = vl.media_id)
  join public.user_media_episodes ume
    on ume.id = e.id
  where ume.user_media_id <> um.id
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Existing episode with different user ownership
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime_episodes',
    e.id::text,
    'conflicting-episode-user-ownership',
    jsonb_build_object(
      'episodeId', ume.id,
      'existingUserId', ume.user_id,
      'attemptedUserId', e.user_id
    )
  from public.user_anime_episodes e
  join public.user_media_episodes ume
    on ume.id = e.id
  where ume.user_id <> e.user_id
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Existing episode with different season or episode number
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime_episodes',
    e.id::text,
    'conflicting-episode-number',
    jsonb_build_object(
      'episodeId', ume.id,
      'existingSeason', ume.season_number,
      'existingNumber', ume.episode_number,
      'attemptedNumber', e.episode_number
    )
  from public.user_anime_episodes e
  join public.user_media_episodes ume
    on ume.id = e.id
  where ume.season_number <> 0 or ume.episode_number <> e.episode_number
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Existing episode with different watched_at timestamp
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime_episodes',
    e.id::text,
    'conflicting-episode-watched-at',
    jsonb_build_object(
      'episodeId', ume.id,
      'existingWatchedAt', ume.watched_at,
      'attemptedWatchedAt', e.watched_at
    )
  from public.user_anime_episodes e
  join public.user_media_episodes ume
    on ume.id = e.id
  where ume.watched_at is distinct from e.watched_at
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Existing episode with different created_at timestamp
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime_episodes',
    e.id::text,
    'conflicting-episode-created-at',
    jsonb_build_object(
      'episodeId', ume.id,
      'existingCreatedAt', ume.created_at,
      'attemptedCreatedAt', e.created_at
    )
  from public.user_anime_episodes e
  join public.user_media_episodes ume
    on ume.id = e.id
  where ume.created_at is distinct from e.created_at
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Alternate unique key (user_media_id, season_number, episode_number) conflict with different primary ID (conflicting fields)
  insert into public.media_backfill_issues
    (run_id, legacy_table, legacy_id, reason, details)
  select
    p_run_id,
    'user_anime_episodes',
    e.id::text,
    'conflicting-alternate-key-episode',
    jsonb_build_object(
      'episodeId', e.id,
      'existingId', ume.id,
      'userMediaId', um.id,
      'episodeNumber', e.episode_number,
      'existingUserId', ume.user_id,
      'attemptedUserId', e.user_id
    )
  from public.user_anime_episodes e
  join pg_temp.phase2b_valid_legacy vl
    on vl.user_id = e.user_id
   and vl.anilist_id = e.anilist_id
  join public.user_media um
    on um.id = vl.id or (um.user_id = vl.user_id and um.media_id = vl.media_id)
  join public.user_media_episodes ume
    on ume.user_media_id = um.id
   and ume.season_number = 0
   and ume.episode_number = e.episode_number
   and ume.id <> e.id
  where ume.user_id <> e.user_id
     or ume.media_kind <> 'anime'
     or ume.watched_at is distinct from e.watched_at
     or ume.created_at is distinct from e.created_at
  on conflict (run_id, legacy_table, legacy_id, reason) do nothing;

  -- Snapshot of valid episodes to insert
  drop table if exists pg_temp.phase2b_valid_episodes;
  create temporary table pg_temp.phase2b_valid_episodes
  on commit drop
  as
  select
    e.id,
    e.user_id,
    um.id as user_media_id,
    e.episode_number,
    e.watched_at,
    e.created_at
  from public.user_anime_episodes e
  join pg_temp.phase2b_valid_legacy vl
    on vl.user_id = e.user_id
   and vl.anilist_id = e.anilist_id
  join public.user_media um
    on um.id = vl.id or (um.user_id = vl.user_id and um.media_id = vl.media_id)
  where e.episode_number > 0
    and vl.media_kind = 'anime';

  -- Insert valid episodes
  insert into public.user_media_episodes (
    id,
    user_id,
    user_media_id,
    media_kind,
    season_number,
    episode_number,
    watched_at,
    created_at
  )
  select
    ve.id,
    ve.user_id,
    ve.user_media_id,
    'anime',
    0,
    ve.episode_number,
    ve.watched_at,
    ve.created_at
  from pg_temp.phase2b_valid_episodes ve
  where not exists (
    select 1 from public.user_media_episodes ume
    where ume.id = ve.id
       or (ume.user_media_id = ve.user_media_id and ume.season_number = 0 and ume.episode_number = ve.episode_number)
  )
  and not exists (
    select 1 from public.media_backfill_issues bi
    where bi.run_id = p_run_id
      and bi.legacy_id = ve.id::text
  );
  get diagnostics v_episodes_inserted = row_count;

  -- 9. Auto-resolve issues for items that were successfully migrated in this run
  update public.media_backfill_issues
  set resolved_at = now()
  where legacy_table = 'user_anime'
    and legacy_id in (
      select vl.id::text
      from pg_temp.phase2b_valid_legacy vl
      join public.user_media um on um.id = vl.id
    )
    and reason in ('missing-catalog-cache', 'malformed-catalog-cache', 'conflicting-catalog-cache', 'unresolved-anime-format')
    and resolved_at is null;

  select count(*)
  into v_issues
  from public.media_backfill_issues
  where run_id = p_run_id;

  update public.media_backfill_runs
  set
    completed_at = clock_timestamp(),
    outcome = 'completed',
    details = jsonb_build_object(
      'media_inserted', v_media_inserted,
      'external_ids_inserted', v_mappings_inserted,
      'user_media_inserted', v_user_media_inserted,
      'episodes_inserted', v_episodes_inserted,
      'issues', v_issues
    )
  where id = p_run_id;

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
  'Idempotently backfills legacy AniList library rows into additive canonical tables. Legacy tables are never modified. In a single transaction, committed runs are recorded as completed; aborted transactions roll back the run row. External orchestration can record failed runs via independent transaction boundaries.';

grant execute on function public.deterministic_anilist_media_id(integer)
  to service_role;
grant execute on function public.backfill_phase2b(uuid)
  to service_role;

-- Schema installation and data backfill are strictly separated.
-- This migration file installs additive functions, schema definitions, and permissions only.
-- The data backfill must be invoked as an explicit operational step post-backup
-- (e.g., via backfill_phase2b() invocation or external orchestrator) by service_role.

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
  ),
  issue_stats as (
    select
      count(*) as total_historical,
      count(*) filter (where resolved_at is null) as unresolved,
      count(*) filter (where resolved_at is not null) as resolved
    from public.media_backfill_issues
  ),
  latest_run as (
    select
      id as run_id,
      started_at,
      completed_at,
      outcome
    from public.media_backfill_runs
    order by started_at desc, id desc
    limit 1
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
    'latest_run_id', (select run_id from latest_run),
    'latest_run_outcome', (select outcome from latest_run),
    'backfill_issues_total_historical', coalesce((select total_historical from issue_stats), 0),
    'backfill_issues_unresolved', coalesce((select unresolved from issue_stats), 0),
    'backfill_issues_resolved', coalesce((select resolved from issue_stats), 0),
    'backfill_issues_latest_run', coalesce((
      select count(*)
      from public.media_backfill_issues
      where run_id = (select run_id from latest_run)
    ), 0),
    'backfill_issues_latest_run_unresolved', coalesce((
      select count(*)
      from public.media_backfill_issues
      where run_id = (select run_id from latest_run)
        and resolved_at is null
    ), 0),
    'backfill_issues', coalesce((select unresolved from issue_stats), 0)
  )
$$;

comment on function public.validate_phase2b() is
  'Read-only validation snapshot for the Phase 2B canonical backfill. Non-zero mismatch/issue counts require review; this function does not delete or repair data.';

grant execute on function public.validate_phase2b()
  to service_role;
