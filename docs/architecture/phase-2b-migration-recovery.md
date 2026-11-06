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
   - `public.deterministic_anilist_media_id(integer)`: Deterministic RFC 4122 UUIDv3 generator for AniList IDs. Uses standard URL namespace (`6ba7b811-9dad-11d1-80b4-00c04fd430c8`) with name `'kaze:anilist:' || anilist_id`. Implemented in pure PostgreSQL core (`md5(bytea)`, `decode`, `convert_to`) without external extension dependencies.
   - `public.backfill_phase2b(uuid)`: Idempotent backfill engine with strict conflict detection.
   - `public.validate_phase2b()`: Read-only data integrity verification snapshot.
   *(Note: No database views exist in Phase 2B; `Views` is empty `Record<string, never>` in TypeScript and database types).*

### Deterministic UUID Scheme & Test Vectors

The deterministic ID function maps legacy integer AniList IDs to stable canonical media UUIDs during migration.

- **Standard:** RFC 4122 UUID version 3 (namespace-based name hashing).
- **Algorithm:**
  $$\text{hash} = \text{MD5}(\text{namespace\_bytes} \mathbin{\Vert} \text{name\_bytes})$$
  Octet 6 is masked with version 3 (`0x30`), and Octet 8 is masked with RFC 4122 variant (`0x80`).
- **Namespace UUID:** `6ba7b811-9dad-11d1-80b4-00c04fd430c8` (RFC 4122 `NameSpace_URL`).
- **Name Format:** `kaze:anilist:<id>` (e.g. `kaze:anilist:1`).
- **Zero Extension Dependencies:** Relies entirely on built-in PostgreSQL core functions (`md5(bytea)`, `decode(text, 'hex')`, `convert_to(text, 'UTF8')`). Does not require `uuid-ossp` or `pgcrypto`.
- **Deterministic, Not Collision-Proof:** The mapping is deterministic: one AniList ID always yields the same UUID, in every environment and on every rerun, so retries and rebuilt environments converge without reconciliation. It is not collision-proof. UUIDv3 truncates an MD5 digest to 122 bits, so two different AniList IDs could theoretically hash to the same UUID; that would surface as a `media` primary-key conflict during backfill, never as silent row merging. No collision has been observed for the IDs in use, and the generator is not the guard against that class of error: the unique `(provider, external_id)` constraint on `media_external_ids` remains the authoritative check that one provider ID maps to exactly one media row.
- **Namespace Semantics (documented deviation):** The generator uses the RFC 4122 `NameSpace_URL` UUID (`6ba7b811-9dad-11d1-80b4-00c04fd430c8`) with the name `kaze:anilist:<id>`. RFC 4122 associates that namespace with URL-shaped names, while this name is a Kaze-internal URN-style key. The pairing is stable, unambiguous inside Kaze, and cannot realistically collide with URL-named UUIDv3s minted by other systems, but it is a convention deviation rather than a strict use of the namespace. A stricter alternative would name `https://anilist.co/anime/<id>` or mint a Kaze-specific namespace UUID. Either choice changes every generated ID, so it must be decided before durable canonical rows exist; after a committed backfill it would require re-deriving IDs and rewriting `media` and `media_external_ids` in a maintenance window. It is out of scope for this pass, and `tests/media-migrations-pg.integration.test.ts` pins the current vectors so an accidental change is caught.
- **Pre-execution Window:** Phase 2B has not been applied to production and the DDL does not auto-invoke the backfill, so no canonical ID is durable yet; the scheme remains changeable at zero data cost until the first backfill commits against a real environment. That is a timing statement, not a collision guarantee.
- **Reference Test Vectors:**
  - AniList ID `1`: `bc1934ba-4c73-38ba-b848-61928124cb64`
  - AniList ID `21`: `d2fbc542-0768-3a30-ab27-040f1dcdeb16`
  - AniList ID `16498`: `6a94b024-3842-3a12-a716-0e91f47cfecb`

---

## 2. Transactional Boundaries & Ledger Semantics

- **DDL Execution:** Each migration file executes inside its own migration transaction. If a table creation or constraint fails during migration application, all schema changes in that migration roll back atomically.
- **Separation of Schema Installation and Data Backfill:** Schema migrations (`20261105000000_create_canonical_media_schema.sql` and `20261105000001_backfill_canonical_library.sql`) create additive tables, constraints, types, functions, and permissions only. They do **not** automatically execute `backfill_phase2b()`. This separation ensures schema deployment is fast and lock-free, and gives operators an explicit gate to verify environment readiness and take backups before data backfill begins.
- **Truthful Transaction & Failure Ledger Semantics:**
  - *Direct Single-Transaction Execution (`select public.backfill_phase2b();`):* When invoked directly in a single SQL statement or transaction, an unhandled database exception causes PostgreSQL to roll back the entire ambient transaction. Because PostgreSQL does not support autonomous transactions within standard functions, any ledger row inserted inside that transaction is also rolled back. Direct SQL execution therefore records **committed** runs (`outcome = 'completed'`); an unhandled crash rolls back completely and reports the error to the calling client session.
  - *External Orchestration (Multi-Transaction Failure Recording):* To persist failed runs in `public.media_backfill_runs`, an external runner or deployment script uses three independent, committed transaction boundaries:

#### Transaction 1: Pre-Register Invocations (Registration & Commit)
Executed with `service_role` permissions:
```sql
-- Transaction 1: Pre-register the run in 'running' state and commit before execution begins.
begin;
insert into public.media_backfill_runs (id, started_at, outcome, details)
values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  clock_timestamp(),
  'running',
  jsonb_build_object(
    'orchestrator', 'kaze-migration-runner',
    'environment', 'staging',
    'invoked_by', 'service_role'
  )
);
commit;
```

#### Transaction 2: Execute Backfill Function (Backfill & Commit)
Executed with `service_role` permissions:
```sql
-- Transaction 2: Execute backfill against pre-registered run.
-- On success: updates run to 'completed' with metrics and commits.
-- On failure: transaction aborts and rolls back completely; canonical tables remain clean.
begin;
select public.backfill_phase2b('00000000-0000-0000-0000-000000000001'::uuid);
commit;
```

#### Transaction 3: Record Execution Failure (Error Recording & Commit)
Executed with `service_role` permissions ONLY when Transaction 2 catches an error and rolls back:
```sql
-- Transaction 3: Persist failure outcome against the surviving Transaction 1 record.
begin;
update public.media_backfill_runs
set
  completed_at = clock_timestamp(),
  outcome = 'failed',
  details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
    'error', 'Unhandled exception during backfill execution',
    'sqlstate', 'XX000',
    'failed_at', clock_timestamp()
  )
where id = '00000000-0000-0000-0000-000000000001'::uuid
  and outcome = 'running';
commit;
```

- **Run ID Reuse Protection & Retries:**
  - `public.backfill_phase2b(p_run_id)` performs a row-level lock check (`select outcome into v_existing_outcome from public.media_backfill_runs where id = p_run_id for update`).
  - If `p_run_id` already exists with `outcome = 'completed'`, execution is aborted immediately with `Run ID % has already completed and cannot be reused.` to prevent corrupting historical run statistics or appending issues to an old run.
  - If `p_run_id` already exists with `outcome = 'failed'`, execution is aborted immediately with `Run ID % has already failed and cannot be reused. Retries must use a new run ID.`. Retries must always generate a fresh run ID to preserve an immutable audit trail.
  - If `p_run_id` exists with `outcome = 'running'`, it is accepted as an orchestrator handoff.
  - If `p_run_id` does not exist, a new run row is inserted in the ambient transaction.
- **Defensive Data Quarantine:** Rather than raising unhandled runtime errors on invalid user data, the backfill identifies anomalies and inserts them into `public.media_backfill_issues`. This allows valid records to migrate successfully while isolating problematic rows for review. A run that quarantines issues still completes and commits successfully with `outcome = 'completed'`.

### Stale & Abandoned Running Records Recovery Procedure

If an orchestrator terminates unexpectedly (host crash, network drop, OOM killer) after Transaction 1, the ledger record remains in `running` state without an orchestrator to record Transaction 3.

1. **Identify Stale Runs:**
   Query runs that have been in `running` state beyond the expected operational duration (e.g., 30 minutes):
   ```sql
   select
     id,
     started_at,
     clock_timestamp() - started_at as elapsed,
     details
   from public.media_backfill_runs
   where outcome = 'running'
     and started_at < clock_timestamp() - interval '30 minutes'
   order by started_at desc;
   ```

2. **Prove the Run Is Not Executing (run-scoped lock check):**
   Do not gate recovery on `pg_stat_activity`. A global `query ~* 'backfill_phase2b'` match is not run-scoped: it matches every unrelated backfill execution and therefore blocks recovery of a stale run while any other run is in flight, and it misses the target entirely when the caller used a parameterized or prepared statement, because `query` then shows `select public.backfill_phase2b($1)` with no run ID in the text.

   The authoritative, run-scoped indicator is the ledger row lock. `public.backfill_phase2b()` takes `select outcome ... for update` on its run row as its first action, and PostgreSQL holds that lock until the transaction ends. Run the check inside the recovery transaction:
   ```sql
   begin;

   -- 55P03 (lock_not_available) means a live transaction is executing this exact run. Stop.
   select id, outcome, started_at
   from public.media_backfill_runs
   where id = '<abandoned-run-id>'::uuid
     and outcome = 'running'
   for update nowait;
   ```
   - **`55P03 lock_not_available`:** a live transaction holds this run row, so `backfill_phase2b()` is executing for this run ID. Roll back and leave the record alone; retry recovery later. Never mark it failed.
   - **One row returned with `outcome = 'running'`:** no transaction holds the run lock, so no execution of this run is in flight. The run is abandoned if it also exceeds the staleness threshold from step 1.
   - **No row returned:** the run is no longer `running` (another runner or orchestrator already terminalised it). Roll back and re-inspect.

   Optional diagnostic evidence, never a gate:
   ```sql
   -- Advisory only: not run-scoped, and parameterized calls hide their arguments.
   select pid, state, query_start, clock_timestamp() - query_start as duration, query
   from pg_stat_activity
   where query ilike '%backfill_phase2b(%'
     and pid <> pg_backend_pid();
   ```

   > **Limitation:** the function does not record its backend PID, so PostgreSQL activity cannot be tied to a run ID from `pg_stat_activity` alone; the row lock is the only safe check. A pre-registered run whose execution transaction has not yet reached the lock (for example an orchestrator still connecting) is momentarily indistinguishable from an abandoned run. The staleness threshold covers that window, and step 3 runs while holding the lock: if the late execution acquires it first, recovery gets `55P03` and aborts; if recovery commits `failed` first, the late execution's own locked read sees `failed` and refuses to run.

3. **Recover Abandoned Run Record (same transaction as the lock check):**
   Close the abandoned ledger record while still holding the run lock, so no execution can start between the check and the update:
   ```sql
   update public.media_backfill_runs
   set
     completed_at = clock_timestamp(),
     outcome = 'failed',
     details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
       'abandonment_reason', 'Orchestrator process crashed or timed out',
       'recovered_at', clock_timestamp()
     )
   where id = '<abandoned-run-id>'::uuid
     and outcome = 'running';

   commit;
   ```

4. **Safe Retry with a New Run ID:**
   Because completed and failed run IDs can never be reused, retries must generate a fresh UUID:
   ```sql
   select public.backfill_phase2b(gen_random_uuid());
   ```

5. **Concurrency Contract:** the run row is locked for the whole execution, so a second runner with the same run ID blocks instead of duplicating work. See [Concurrency Contract & Verification](#concurrency-contract--verification) below.

### Concurrency Contract & Verification

`public.backfill_phase2b(p_run_id)` serialises on the ledger row (`select outcome ... for update`), which it holds until its transaction ends:

1. Runner A locks `media_backfill_runs.id = p_run_id` and performs the backfill.
2. Runner B, using the same run ID, blocks on that row lock instead of starting.
3. Runner A commits `outcome = 'completed'`. B's locked read then returns `completed` and B aborts with `check_violation` before writing anything, so exactly one execution writes and no duplicate `media`, `user_media`, `user_media_episodes` or issue rows exist.
4. If A's transaction aborts instead, A's ledger update rolls back to `running` and A wrote nothing. B unblocks, sees `running`, and performs the work — a safe takeover, still exactly once.
5. If no ledger row exists yet, both runners attempt the insert and the primary key rejects the loser with a unique violation. Pre-registering the run (Transaction 1) keeps that path out of the normal flow.

**What the automated suite does not cover.** `tests/media-migrations-pg.integration.test.ts` runs on PGlite, which embeds a single-session PostgreSQL (`pg_stat_activity` shows exactly one backend) and funnels every statement through one serialized connection. Two transactions cannot be open at once, so row-lock contention cannot be produced or observed there. The suite therefore asserts the lock ordering in the function body and pins the run-ID reuse contract; it does **not** claim concurrency coverage. That test name says so explicitly.

**Verify on real PostgreSQL / Supabase staging with two sessions.**

Calling `backfill_phase2b(<run-id>)` directly from two sessions is *not* this test. With no pre-registered ledger row, both runners pass the empty lock read and then race on the `media_backfill_runs` insert, so the loser fails with a `23505` unique violation on the primary key instead of the intended `23514` completed-run rejection. Pre-register first, exactly as Transaction 1 of the orchestration protocol requires.

Transaction 1 — pre-register the run ID and commit (once per scenario; a terminalised run ID can never be reused):
```sql
begin;
insert into public.media_backfill_runs (id, started_at, outcome, details)
values (
  '00000000-0000-0000-0000-000000000001'::uuid,
  clock_timestamp(),
  'running',
  jsonb_build_object('orchestrator', 'kaze-migration-runner', 'environment', 'staging')
);
commit;
```

#### Scenario A — Runner A commits, Runner B is rejected

Session A must capture its own backend PID, because once it is inside `pg_sleep(30)` its current statement no longer mentions the backfill and query-text matching cannot find it.

```bash
# Terminal A — the executing session.
psql "$DATABASE_URL"
```
```sql
begin;
select pg_backend_pid() as session_a_pid;   -- record this value
select public.backfill_phase2b('00000000-0000-0000-0000-000000000001'::uuid);
select pg_sleep(30);                        -- keeps the transaction and ledger row lock open
commit;
```

```bash
# Terminal B — the competing session, started while A is still sleeping.
psql "$DATABASE_URL"
```
```sql
select pg_backend_pid() as session_b_pid;   -- record this value
select public.backfill_phase2b('00000000-0000-0000-0000-000000000001'::uuid);  -- blocks here
```

B prints nothing until A commits. Observe the wait from a short-lived third connection (it never executes the backfill), substituting the PIDs printed by A and B:
```psql
\set session_a_pid 12345
\set session_b_pid 12346

-- 1. Identify Session A by PID. While A is inside pg_sleep its current statement is
--    select pg_sleep(30), so a query-text filter for 'backfill_phase2b' would miss it;
--    the captured PID is the reliable handle.
select pid, state, wait_event_type, wait_event, left(query, 60) as current_query
from pg_stat_activity
where pid = :session_a_pid;
-- Expect: state = 'active', wait_event_type = 'Timeout', wait_event = 'PgSleep',
-- current_query = 'select pg_sleep(30);'.

-- 2. Identify Session B's lock wait, who blocks it, and the relation the blocker locked.
select
  b.pid as session_b_pid,
  b.state,
  b.wait_event_type,
  b.wait_event,
  left(b.query, 90) as session_b_query,
  pg_blocking_pids(b.pid) as blocked_by_pids,
  a.pid as blocker_pid,
  a.wait_event_type as blocker_wait_event_type,
  a.wait_event as blocker_wait_event,
  l.mode as blocker_lock_mode,
  l.granted as blocker_lock_granted
from pg_stat_activity b
join pg_stat_activity a
  on a.pid = any (pg_blocking_pids(b.pid))
join pg_locks l
  on l.pid = a.pid
 and l.relation = 'public.media_backfill_runs'::regclass
where b.pid = :session_b_pid;
-- Expect: wait_event_type = 'Lock' (commonly wait_event = 'transactionid'),
-- blocked_by_pids = {<session_a_pid>}, blocker_wait_event = 'PgSleep', and
-- blocker_lock_mode in ('RowShareLock', 'RowExclusiveLock') with blocker_lock_granted = true:
-- the lock backfill_phase2b() took when it selected the run-ledger row FOR UPDATE.
```

`pg_locks` does not expose the identity of the locked row, so the row-level attribution comes from the combination above: B is blocked by A's transaction, A still holds the `media_backfill_runs` relation lock taken by the `FOR UPDATE`, and B's own statement names the same run ID.

Expected sequence:
1. B blocks on the ledger row lock and writes nothing.
2. A commits `outcome = 'completed'` with its metrics.
3. B resumes, re-reads the locked row as `completed`, and exits non-zero with SQLSTATE `23514` (`check_violation`) and `Run ID 00000000-0000-0000-0000-000000000001 has already completed and cannot be reused.`
4. No `23505` unique violation appears; that would mean the run was not pre-registered and the wrong path was exercised.

#### Scenario B — Runner A aborts, Runner B performs the backfill exactly once

Use a second, freshly pre-registered run ID (`<second-pre-registered-run-id>`); the ID from Scenario A is now `completed` and cannot be reused. The same PID-based diagnostics apply with the new values.

```bash
# Terminal A — execute the backfill, hold the lock, then abort instead of committing.
psql "$DATABASE_URL"
```
```sql
begin;
select pg_backend_pid() as session_a_pid;   -- record this value
select public.backfill_phase2b('<second-pre-registered-run-id>'::uuid);
select pg_sleep(30);
rollback;                                    -- or press Ctrl+C to abort the transaction
```

```bash
# Terminal B — started while A is still sleeping: same pre-registered run ID.
psql "$DATABASE_URL"
```
```sql
select pg_backend_pid() as session_b_pid;   -- record this value
select public.backfill_phase2b('<second-pre-registered-run-id>'::uuid);  -- blocks here
```

Expected sequence:
1. B blocks on the ledger row lock while A holds it.
2. A rolls back: its `media`, mapping, library, episode, issue and `completed` ledger writes disappear, and the ledger row returns to the `running` state committed in Transaction 1.
3. B unblocks, sees `running`, performs the full backfill and commits `outcome = 'completed'`.
4. Exactly one execution wrote data (A wrote nothing), so there is no duplicate row and no quarantine record attributable to A.

After either scenario, confirm the ledger and the row counts. Every duplicate check groups by the table's actual unique key:
```sql
select id, outcome, completed_at is not null as completed, details
from public.media_backfill_runs
where id = '<run-id>'::uuid;

select
  (select count(*) from public.media) as media_rows,
  (select count(*) from public.user_media) as user_media_rows,
  (select count(*) from public.user_media_episodes) as episode_rows,
  (select count(*) from (
     select user_id, media_id from public.user_media
     group by 1, 2 having count(*) > 1              -- user_media_user_media_key
   ) duplicate_library) as duplicate_library_rows,
  (select count(*) from (
     select provider, external_id from public.media_external_ids
     group by 1, 2 having count(*) > 1              -- media_external_ids_provider_external_key
   ) duplicate_mappings) as duplicate_mapping_rows,
  (select count(*) from (
     select user_media_id, season_number, episode_number from public.user_media_episodes
     group by 1, 2, 3 having count(*) > 1           -- user_media_episodes_user_media_key
   ) duplicate_episodes) as duplicate_episode_rows,
  (select count(*) from (
     select run_id, legacy_table, legacy_id, reason from public.media_backfill_issues
     group by 1, 2, 3, 4 having count(*) > 1        -- media_backfill_issues_run_legacy_reason_key
   ) duplicate_issues) as duplicate_issue_rows;
-- Both scenarios: outcome = 'completed', completed = true,
-- media_rows = distinct legacy AniList IDs, user_media_rows = distinct legacy library IDs,
-- episode_rows = distinct legacy episode IDs, and every duplicate_* count = 0.
-- (public.media rows are keyed by the primary key id, so duplicate media rows are impossible.)

-- Provider mappings that violate the intent of unique (provider, external_id): one provider
-- ID pointing at more than one media row. This is the conflict the count above detects.
select
  provider,
  external_id,
  count(*) as mapping_rows,
  array_agg(media_id order by media_id) as conflicting_media_ids
from public.media_external_ids
-- group by the unique key only; including media_id would hide a split mapping
-- by producing one group per media row instead of one conflicting group.
group by provider, external_id
having count(*) > 1
order by provider, external_id;
-- Expect zero rows. Any row lists the media IDs that claim the same provider ID;
-- cross-reference public.media and public.media_titles to decide which ID is correct.
--
-- Every duplicate check above is guarded by the unique key named beside it, so a non-zero
-- count means that constraint is missing or was dropped in this environment, not that the
-- backfill created duplicates under a working constraint.
```

---

## 3. Preconditions & Backup Requirements

### Preconditions
- PostgreSQL 15+ with `gen_random_uuid()` / `pgcrypto`.
- Schema `public` has existing `user_anime`, `user_anime_episodes`, and `catalog_cache`.
- User authentication references `auth.users (id)`.
- Application runs exclusively against existing legacy tables; no live cutover during Phase 2B.

### Operational Deployment Sequence

1. **Apply Schema Migrations (DDL only):**
   ```bash
   supabase db push
   # or via CI/CD migration pipeline
   ```
   Installs canonical schema tables, constraints, types, functions (`backfill_phase2b`, `validate_phase2b`), and grants to `service_role`. No data backfill runs during this step.

2. **Pre-Backfill Verification:**
   Execute with `service_role` permissions:
   ```sql
   select public.validate_phase2b();
   ```
   Confirms clean schema installation and reports existing legacy counts prior to population.

3. **Backup Legacy Tables:**
   Execute `pg_dump` on legacy tables before initiating the backfill:
   ```bash
   pg_dump -h <host> -U <user> -d <db> \
     -t public.user_anime \
     -t public.user_anime_episodes \
     -t public.catalog_cache \
     > kaze_legacy_backup_$(date +%Y%m%d_%H%M%S).sql
   ```
   *Note: Because the backfill function never drops, alters, or mutates legacy rows, legacy data remains untouched even if errors occur.*

4. **Explicitly Invoke Data Backfill:**
   Execute with `service_role` permissions:
   ```sql
   select public.backfill_phase2b();
   ```
   Or invoke with an explicit, pre-registered UUID via an external orchestrator:
   ```sql
   select public.backfill_phase2b('00000000-0000-0000-0000-000000000001'::uuid);
   ```

5. **Post-Backfill Verification:**
   Execute with `service_role` permissions:
   ```sql
   select public.validate_phase2b();
   ```
   Verify that `per_user_count_mismatches = 0`, `duplicate_external_id_groups = 0`, `orphan_canonical_episodes = 0`, and inspect any quarantined issues.

### Backup Requirements

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

### Phase 2C and Later Rollback Limits

> [!CAUTION]
> Phase 2C does **not** make `public.user_media` or
> `public.user_media_episodes` authoritative. Legacy user tables remain the
> authority and canonical user tables remain projections. No rollback may
> reverse-write canonical data into legacy tables.

The pre-cutover rollback above is safe only after confirming that no approved
canonical-only data or canonical consumers depend on the additive objects. A
Phase 2C rollback must first disable projection writers, preserve legacy
authority, and verify that canonical reads have not been separately enabled.
Canonical projections may then be rebuilt from legacy or removed under an
approved maintenance procedure.

If a later, separately approved canonical-read cutover has occurred, rollback
requires preserving canonical-only state and an explicit retention/conversion
plan. It is not automatically lossless for movie or TV state that the legacy
schema cannot represent. Reverse-backfilling canonical data into legacy tables
is not part of the Phase 2C architecture.
