# Phase 2B Migration & Recovery Procedure

- **Status:** Approved for Phase 2B Final Corrective Pass
- **Scope:** Additive canonical media schema, AniList backfill, conflict handling, quarantine ledger, and safe recovery/rollback.

---

## 1. What the Migration Creates and Backfills

The Phase 2B migrations are strictly **additive**. Legacy tables (`public.user_anime`, `public.user_anime_episodes`, and `public.catalog_cache`) remain authoritative throughout Phase 2B. No application runtime repositories or routes read or write from the new canonical tables until an explicit, separately approved cutover in Phase 2C.

### Objects Created:
1. **Canonical Schema Tables (`20261105000000_create_canonical_media_schema.sql`):**
   - `public.media`: Central identity entity constrained to `'anime'`, `'manga'`, `'movie'`, `'tv'`.
   - `public.media_external_ids`: Provider mappings (AniList, Kitsu, TMDB, MAL, MangaDex).
   - `public.media_titles`: Multilingual title sets with unique primary title enforcement.
   - `public.media_artwork`: Provider artwork with roles (`poster`, `backdrop`, `banner`, `logo`) and focal points.
   - `public.media_anime_details`: Anime-specific format metadata (episodes, duration, season, studios).
   - `public.media_manga_details`: Manga-specific format metadata (chapters, volumes, authors, artists).
   - `public.media_movie_details`: Movie-specific metadata (runtime, production companies, cast/crew JSON).
   - `public.media_tv_details`: TV-specific metadata (seasons, episodes, networks, next episode JSON).
   - `public.user_media`: User library tracking with kind-specific progress constraints (`episodes_watched`, `chapters_read`, `volumes_read`, `movie_watched`, TV fields), unique keys `(id)`, `(user_id, media_id)`, and composite foreign key `(media_id, media_kind)`.
   - `public.user_media_episodes`: Granular episode watch history constrained to `'anime'` and `'tv'` kinds, bound to `user_media` via declarative composite foreign key `(user_media_id, user_id, media_kind)`.
   - `public.media_backfill_runs`: Invocation ledger recording every backfill run (run ID, started_at, completed_at, outcome, details), ensuring zero-issue runs are reliably tracked.
   - `public.media_backfill_issues`: Diagnostic ledger quarantining malformed, conflicting, or missing legacy rows, referencing `media_backfill_runs(id)`.
2. **Database Functions (`20261105000001_backfill_canonical_library.sql`):**
   - `public.deterministic_anilist_media_id(integer)`: Immutable UUIDv5 generator for AniList IDs.
   - `public.backfill_phase2b(uuid)`: Idempotent backfill engine with strict conflict detection.
   - `public.validate_phase2b()`: Read-only data integrity verification snapshot.
   *(Note: No database views exist in Phase 2B; `Views` is empty `Record<string, never>` in TypeScript and database types).*

---

## 2. Transactional Boundaries

- **DDL Execution:** Each migration file executes inside its own migration transaction. If a table creation or constraint fails during migration application, all schema changes in that migration roll back atomically.
- **Backfill Execution:** `public.backfill_phase2b(p_run_id)` is a PL/pgSQL function. A single invocation runs within an atomic transaction. If an unhandled database exception occurs, all inserts from that run roll back.
- **Defensive Error Handling:** Rather than raising unhandled runtime errors on invalid user data, the backfill identifies anomalies and inserts them into `public.media_backfill_issues`. This allows valid records to migrate successfully while isolating problematic rows for review.

---

## 3. Preconditions & Backup Requirements

### Preconditions
- PostgreSQL 15+ with `gen_random_uuid()` / `pgcrypto`.
- Schema `public` has existing `user_anime`, `user_anime_episodes`, and `catalog_cache`.
- User authentication references `auth.users (id)`.
- Application runs exclusively against existing legacy tables; no live cutover during Phase 2B.

### Backup Requirements
Before executing `backfill_phase2b()` in staging or production:
```bash
pg_dump -h <host> -U <user> -d <db> \
  -t public.user_anime \
  -t public.user_anime_episodes \
  -t public.catalog_cache \
  > kaze_legacy_backup_$(date +%Y%m%d_%H%M%S).sql
```
*Note: Because the backfill migration never drops, alters, or mutates legacy rows, legacy data remains untouched even if errors occur.*

---

## 4. Quarantined Records Inspection

Any row with malformed, conflicting, or missing metadata is preserved in `public.media_backfill_issues`.

### Summary of Issues:
```sql
select reason, count(*) as issue_count
from public.media_backfill_issues
where resolved_at is null
group by reason
order by issue_count desc;
```

### Inspecting Specific Quarantine Categories:
1. **Missing or Inconclusive Catalog Cache Metadata:**
   ```sql
   select legacy_id, details
   from public.media_backfill_issues
   where reason in ('missing-catalog-cache', 'malformed-catalog-cache', 'conflicting-catalog-cache')
     and resolved_at is null;
   ```
2. **Library Entity Conflicts (Primary ID & Alternate Key):**
   ```sql
   select legacy_table, legacy_id, reason, details
   from public.media_backfill_issues
   where reason in (
     'conflicting-library-user-ownership',
     'conflicting-library-media-id',
     'conflicting-library-media-kind',
     'conflicting-library-status',
     'conflicting-library-progress',
     'conflicting-library-score',
     'conflicting-library-notes',
     'conflicting-library-favorite',
     'conflicting-library-dates',
     'conflicting-library-timestamps',
     'conflicting-alternate-key-library'
   ) and resolved_at is null;
   ```
3. **Episode Entity Conflicts:**
   ```sql
   select legacy_table, legacy_id, reason, details
   from public.media_backfill_issues
   where reason in (
     'conflicting-episode-parent',
     'conflicting-episode-user-ownership',
     'conflicting-episode-number',
     'conflicting-episode-watched-at',
     'conflicting-episode-created-at',
     'conflicting-alternate-key-episode',
     'movie-episode-history',
     'manga-episode-history'
   ) and resolved_at is null;
   ```

---

## 5. Correcting Missing Metadata & Resuming Partial Backfills

If rows were quarantined due to missing or malformed catalog cache entries:
1. **Hydrate Cache:**
   Populate `public.catalog_cache` with valid JSON payloads for the quarantined `anilist_id` values:
   - Key: `details:<id>` or `summary:<id>`
   - Payload: must include `"format": "MOVIE"` or a series format (`"TV"`, `"OVA"`, etc.)
2. **Safely Rerun the Backfill:**
   ```sql
   select public.backfill_phase2b();
   ```
   - **Idempotency:** Any canonical row or library entry that already exists with identical data is treated as an idempotent rerun and skipped without re-inserting. Alternate unique key matches `(user_id, media_id)` and `(user_media_id, season_number, episode_number)` with different primary UUIDs but identical fields are recognized as idempotent matches and skipped without logging false conflict records.
   - **Conflict Protection:** Any conflicting rows remain quarantined; existing data is never overwritten. If an alternate unique key matches but any field differs, it is quarantined under `conflicting-alternate-key-library` or `conflicting-alternate-key-episode`.
   - **Automatic Resolution:** Rows previously quarantined under `missing-catalog-cache`, `malformed-catalog-cache`, or `conflicting-catalog-cache` that now have unambiguous metadata are inserted, and their prior issue records are automatically updated with `resolved_at = now()`.

---

## 6. Identifying Partially Completed Runs & Verification

To verify row counts, foreign key integrity, and progress shapes, run:
```sql
select public.validate_phase2b();
```

Expected healthy output shape:
```json
{
  "legacy_user_anime": 150,
  "canonical_user_media": 150,
  "legacy_user_anime_episodes": 1200,
  "canonical_user_media_episodes": 1200,
  "media_rows": 150,
  "external_id_rows": 150,
  "duplicate_external_id_groups": 0,
  "missing_media_fk": 0,
  "invalid_progress_rows": 0,
  "orphan_canonical_episodes": 0,
  "legacy_library_ids_missing_from_canonical": 0,
  "legacy_episode_ids_missing_from_canonical": 0,
  "per_user_count_mismatches": 0,
  "latest_run_id": "00000000-0000-0000-0000-000000000001",
  "latest_run_outcome": "completed",
  "backfill_issues_total_historical": 12,
  "backfill_issues_unresolved": 0,
  "backfill_issues_resolved": 12,
  "backfill_issues_latest_run": 0,
  "backfill_issues_latest_run_unresolved": 0,
  "backfill_issues": 0
}
```

Validation output fields:
- `latest_run_id`: UUID of the latest invocation from `public.media_backfill_runs`.
- `latest_run_outcome`: Outcome of the latest invocation (`'completed'`, `'running'`, or `'failed'`).
- `backfill_issues_total_historical`: Count of all historical issue records across all backfill runs.
- `backfill_issues_unresolved`: Count of issues where `resolved_at is null` (active failures).
- `backfill_issues_resolved`: Count of issues where `resolved_at is not null` (successfully resolved).
- `backfill_issues_latest_run`: Count of issues created during the latest backfill run (correctly 0 on zero-issue runs).
- `backfill_issues_latest_run_unresolved`: Count of issues in the latest run that remain unresolved.
- `backfill_issues`: Set to `backfill_issues_unresolved` so that resolved historical issues do not trigger false alerts.

If `legacy_library_ids_missing_from_canonical` or `backfill_issues_unresolved` is greater than 0:
- Cross-reference `select * from public.media_backfill_issues where resolved_at is null;` to inspect why those specific rows were quarantined.

---

## 7. What Must NOT Be Manually Deleted or Overwritten

- **Do NOT truncate or delete from legacy tables:** `public.user_anime`, `public.user_anime_episodes`, and `public.catalog_cache` must remain untouched.
- **Do NOT manually force-insert or mutate `user_media` rows:** The check constraint `user_media_progress_shape` strictly enforces mutually exclusive columns based on `media_kind`. Manually populating `episodes_watched` on a movie or `movie_watched` on an anime will violate database check constraints.
- **Do NOT delete from `public.media_backfill_issues` or `public.media_backfill_runs`:** They serve as an audit ledger. Issues are resolved by setting `resolved_at = now()`, not by deletion.

---

## 8. Rollback Procedures & Their Strict Limits

### Pre-Cutover Rollback (Phase 2B Safe Window)
During Phase 2B, the application is **not writing to canonical tables**. The canonical tables contain only backfilled copies of legacy data. Therefore, rolling back Phase 2B involves dropping only the new additive objects in reverse dependency order:

```sql
begin;

-- 1. Drop migration functions
drop function if exists public.validate_phase2b();
drop function if exists public.backfill_phase2b(uuid);
drop function if exists public.deterministic_anilist_media_id(integer);

-- 2. Drop additive tables (reverse order of creation)
drop table if exists public.media_backfill_issues cascade;
drop table if exists public.media_backfill_runs cascade;
drop table if exists public.user_media_episodes cascade;
drop table if exists public.user_media cascade;
drop table if exists public.media_tv_details cascade;
drop table if exists public.media_movie_details cascade;
drop table if exists public.media_manga_details cascade;
drop table if exists public.media_anime_details cascade;
drop table if exists public.media_artwork cascade;
drop table if exists public.media_titles cascade;
drop table if exists public.media_external_ids cascade;
drop table if exists public.media cascade;

commit;
```

**State After Pre-Cutover Rollback:**
- All legacy tables (`user_anime`, `user_anime_episodes`, `catalog_cache`) are completely unchanged.
- The Kaze application continues running with zero disruption and zero lost progress.

### Post-Cutover Rollback Limits (CRITICAL WARNING)
> [!CAUTION]
> Once the application is cut over in Phase 2C to write new user tracking data directly to `public.user_media` and `public.user_media_episodes`, **the above rollback script is NO LONGER SAFE**.
>
> Executing `drop table user_media cascade` after cutover would permanently destroy any user progress, ratings, or notes recorded since the cutover date.
>
> A post-cutover rollback requires:
> 1. Exporting all newly created/updated canonical rows.
> 2. Dual-writing or reverse-backfilling canonical data back into `public.user_anime` and `public.user_anime_episodes`.
> 3. Verifying legacy row parity before any canonical table can be altered.
