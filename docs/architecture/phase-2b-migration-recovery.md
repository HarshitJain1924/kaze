# Phase 2B Migration & Recovery Procedure

- **Status:** Approved for Phase 2B Corrective Pass
- **Scope:** Additive canonical media schema, AniList backfill, quarantine ledger, and safe rollback.

---

## 1. Architecture & Migration Order

The Phase 2B migrations are strictly **additive**. Legacy tables (`user_anime`, `user_anime_episodes`, `catalog_cache`) remain authoritative throughout Phase 2B. No application runtime repositories or routes read or write from the new canonical tables until an explicit cutover in Phase 2C.

### Execution Order:
1. `20261021000000_create_catalog_cache.sql` (Pre-existing catalog cache table)
2. `20261105000000_create_canonical_media_schema.sql` (Additive canonical media, details, user_media, and episode history tables)
3. `20261105000001_backfill_canonical_library.sql` (Functions `deterministic_anilist_media_id`, `backfill_phase2b`, and validation)

---

## 2. Preconditions & Backup Requirements

### Preconditions
- PostgreSQL 15+ with `gen_random_uuid()` / `pgcrypto`.
- Schema `public` has existing `user_anime`, `user_anime_episodes`, and `catalog_cache`.
- User authentication references `auth.users (id)`.
- Application runs against existing legacy tables; no live cutover during this phase.

### Backup Requirements
Before executing `backfill_phase2b()` in production or staging:
```bash
pg_dump -h <host> -U <user> -d <db> -t public.user_anime -t public.user_anime_episodes -t public.catalog_cache > kaze_legacy_backup_$(date +%Y%m%d_%H%M%S).sql
```
*Note: Because the migration never drops or mutates legacy rows, legacy data remains untouched even if the backfill encounters errors.*

---

## 3. Quarantined Records Inspection

Any row with malformed, conflicting, or missing metadata is preserved in `public.media_backfill_issues`.

### Summary of Issues:
```sql
select reason, count(*) as issue_count
from public.media_backfill_issues
group by reason
order by issue_count desc;
```

### Inspecting Specific Quarantine Reasons:
- **Missing Catalog Metadata (Unresolved Movie vs TV Series):**
  ```sql
  select legacy_id, details
  from public.media_backfill_issues
  where reason = 'missing-catalog-cache';
  ```
- **Conflicting Existing Media or Mappings:**
  ```sql
  select legacy_table, legacy_id, reason, details
  from public.media_backfill_issues
  where reason in ('conflicting-canonical-media-kind', 'conflicting-provider-mapping', 'conflicting-library-progress');
  ```

---

## 4. Resuming a Partial Backfill & Rerunning

The migration function `public.backfill_phase2b(p_run_id)` is **fully idempotent and non-destructive**:
```sql
select public.backfill_phase2b();
```

- **Rerun Behavior:**
  - If a canonical row or library entry already exists with identical data, it is treated as a successful idempotent rerun (no duplicate rows, no errors).
  - If conflicting data exists, it is recorded in `media_backfill_issues` and user data is never overwritten.
  - If an item was previously quarantined under `missing-catalog-cache` and the metadata has since been populated in `catalog_cache`, the rerun automatically classifies the row as `movie` or `anime`, inserts the canonical records, and marks the earlier issue as `resolved_at = now()`.

---

## 5. Verification: Counts & Field Equality

Run the built-in validation function:
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
  "per_user_count_mismatches": 0,
  "backfill_issues": 0
}
```
*If `backfill_issues > 0`, inspect `public.media_backfill_issues` to review quarantined rows.*

---

## 6. Non-Destructive Rollback Procedure

If you must roll back Phase 2B, drop the additive canonical objects in reverse dependency order. **Do NOT drop or modify legacy tables.**

```sql
begin;

-- 1. Drop migration functions
drop function if exists public.validate_phase2b();
drop function if exists public.backfill_phase2b(uuid);
drop function if exists public.deterministic_anilist_media_id(integer);

-- 2. Drop additive tables (reverse order of creation)
drop table if exists public.media_backfill_issues cascade;
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

### Legacy State After Rollback
- `public.user_anime`: Unchanged and fully operational.
- `public.user_anime_episodes`: Unchanged and fully operational.
- `public.catalog_cache`: Unchanged and fully operational.
- The Kaze application continues running with zero downtime or missing user data.

---

## 7. Manual Recovery Scenarios

The following scenarios require manual recovery:
1. **Manual external-ID mappings:** If manual mappings were linked in `public.media_external_ids` prior to a rollback, export them before executing the rollback SQL:
   ```sql
   copy (select * from public.media_external_ids) to '/tmp/kaze_external_ids.csv' with csv header;
   ```
2. **Conflicting legacy records:** Records flagged with `conflicting-media-kind` (e.g. historical bugs where the same AniList ID was saved as both anime and manga by different users) must be manually reviewed before they can be assigned a single canonical kind.

