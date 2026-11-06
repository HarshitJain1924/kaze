import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";

// Each test boots an embedded PostgreSQL instance and applies all Phase 2B and Phase 2C
// foundation migrations, which
// takes a few seconds; the 5s default is not enough headroom when 27 files run in parallel.
vi.setConfig({ testTimeout: 30_000 });

const migrationFiles = [
  "20261018000000_create_user_anime.sql",
  "20261018000001_create_user_anime_episodes.sql",
  "20261021000000_create_catalog_cache.sql",
  "20261101000000_add_media_type_and_volumes.sql",
  "20261105000000_create_canonical_media_schema.sql",
  "20261105000001_backfill_canonical_library.sql",
  "20261105000002_harden_phase2b_function_execute_privileges.sql",
  "20261107000000_create_phase2c_database_foundation.sql",
];

async function createCleanDatabase(): Promise<PGlite> {
  const db = new PGlite();

  // Configure Supabase-compatible roles and mock auth schema
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema if not exists auth;
    create table if not exists auth.users (
      id uuid primary key
    );
    create or replace function auth.uid() returns uuid language sql stable as $$
      select '00000000-0000-0000-0000-000000000001'::uuid
    $$;
  `);

  for (const filename of migrationFiles) {
    const sqlPath = resolve(process.cwd(), "supabase/migrations", filename);
    const sql = readFileSync(sqlPath, "utf-8");
    await db.exec(sql);
  }

  return db;
}

describe("PostgreSQL Real Engine Integration Tests", () => {
  it("applies all migrations successfully and executes validate_phase2b() against clean database", async () => {
    const db = await createCleanDatabase();
    try {
      const res = await db.query<{ val: Record<string, unknown> }>(
        "select public.validate_phase2b() as val;",
      );
      expect(res.rows).toHaveLength(1);
      const val = res.rows[0]!.val;

      expect(val.legacy_user_anime).toBe(0);
      expect(val.canonical_user_media).toBe(0);
      expect(val.media_rows).toBe(0);
      expect(val.external_id_rows).toBe(0);
      expect(val.duplicate_external_id_groups).toBe(0);
      expect(val.missing_media_fk).toBe(0);
      expect(val.invalid_progress_rows).toBe(0);
      expect(val.orphan_canonical_episodes).toBe(0);
      expect(val.per_user_count_mismatches).toBe(0);
      expect(val.latest_run_id).toBeNull();
      expect(val.latest_run_outcome).toBeNull();
      expect(val.backfill_issues).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("installs Phase 2C roles, durable control tables, RLS, and function ACLs", async () => {
    const db = await createCleanDatabase();
    try {
      const roles = await db.query<{
        rolname: string;
        rolsuper: boolean;
        rolcanlogin: boolean;
        rolbypassrls: boolean;
        rolinherit: boolean;
      }>(`
        select rolname, rolsuper, rolcanlogin, rolbypassrls, rolinherit
        from pg_roles
        where rolname in ('phase2c_api_owner', 'phase2c_reconcile_owner')
        order by rolname;
      `);
      expect(roles.rows).toHaveLength(2);
      for (const role of roles.rows) {
        expect(role.rolsuper).toBe(false);
        expect(role.rolcanlogin).toBe(false);
        expect(role.rolbypassrls).toBe(false);
        expect(role.rolinherit).toBe(false);
      }

      const tables = await db.query<{
        relname: string;
        relforcerowsecurity: boolean;
        api_delete: boolean;
        reconcile_delete: boolean;
        service_delete: boolean;
      }>(`
        select
          c.relname,
          c.relforcerowsecurity,
          has_table_privilege('phase2c_api_owner', c.oid, 'delete') as api_delete,
          has_table_privilege('phase2c_reconcile_owner', c.oid, 'delete') as reconcile_delete,
          has_table_privilege('service_role', c.oid, 'delete') as service_delete
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in ('phase2c_entry_coordination',
                            'phase2c_projection_state',
                            'phase2c_reconciliation_issues')
        order by c.relname;
      `);
      expect(tables.rows).toHaveLength(3);
      for (const table of tables.rows) {
        expect(table.relforcerowsecurity).toBe(true);
        expect(table.api_delete).toBe(false);
        expect(table.reconcile_delete).toBe(false);
        expect(table.service_delete).toBe(false);
      }

      const functions = await db.query<{
        routine: string;
        owner: string;
        prosecdef: boolean;
        config: string[] | null;
        authenticated_execute: boolean;
        anon_execute: boolean;
      }>(`
        select
          p.oid::regprocedure::text as routine,
          r.rolname as owner,
          p.prosecdef,
          p.proconfig as config,
          has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute,
          has_function_privilege('anon', p.oid, 'execute') as anon_execute
        from pg_proc p
        join pg_roles r on r.oid = p.proowner
        where p.oid in ('public.phase2c_read_library()'::regprocedure,
                        'public.phase2c_read_entry_state(integer)'::regprocedure)
        order by routine;
      `);
      expect(functions.rows).toHaveLength(2);
      for (const fn of functions.rows) {
        expect(fn.owner).toBe("phase2c_api_owner");
        expect(fn.prosecdef).toBe(true);
        expect(fn.config ?? []).toContain("search_path=\"\"");
        expect(fn.authenticated_execute).toBe(true);
        expect(fn.anon_execute).toBe(false);
      }
    } finally {
      await db.close();
    }
  });

  it("returns bootstrap and synchronized legacy-backed read envelopes", async () => {
    const db = await createCleanDatabase();
    try {
      const userId = "00000000-0000-0000-0000-000000000001";
      const entryId = "10000000-0000-0000-0000-000000000001";
      const mediaId = "20000000-0000-0000-0000-000000000001";
      await db.query(`insert into auth.users (id) values ('${userId}');`);
      await db.query(`
        insert into public.user_anime
          (id, user_id, anilist_id, media_type, status, progress, volumes_progress)
        values
          ('${entryId}', '${userId}', 321, 'anime', 'watching', 2, 0);
      `);

      const pending = await db.query<{ value: Record<string, unknown> }>(
        "select public.phase2c_read_library() as value;",
      );
      expect(pending.rows[0]!.value).toMatchObject({
        libraryStatus: "bootstrap_pending",
      });
      expect((pending.rows[0]!.value.entries as unknown[])).toHaveLength(1);
      expect(
        (pending.rows[0]!.value.entries as Array<Record<string, unknown>>)[0]!
          .projectionStatus,
      ).toBe("bootstrap_pending");

      const pendingState = await db.query<{ value: Record<string, unknown> }>(
        "select public.phase2c_read_entry_state(321) as value;",
      );
      expect(pendingState.rows[0]!.value).toEqual({
        status: "bootstrap_pending",
      });

      await db.query(`insert into public.media (id, kind) values ('${mediaId}', 'anime');`);
      await db.query(`
        insert into public.user_media
          (id, user_id, media_id, media_kind, status, episodes_watched)
        values
          ('${entryId}', '${userId}', '${mediaId}', 'anime', 'watching', 2);
      `);
      await db.query(`
        insert into public.phase2c_entry_coordination
          (user_id, anilist_id, generation, deleted, source_revision,
           lifecycle_version, progress_version, score_version, notes_version)
        values ('${userId}', 321, 1, false, 1, 1, 1, 1, 1);
      `);
      await db.query(`
        insert into public.phase2c_projection_state
          (user_id, anilist_id, generation, projection_revision, projected_deleted)
        values ('${userId}', 321, 1, 1, false);
      `);

      const live = await db.query<{ value: Record<string, unknown> }>(
        "select public.phase2c_read_library() as value;",
      );
      expect(live.rows[0]!.value).toMatchObject({ libraryStatus: "ready" });
      const entry = (live.rows[0]!.value.entries as Array<Record<string, unknown>>)[0]!;
      expect(entry.projectionStatus).toBe("synchronized");
      expect(entry.cas).toMatchObject({
        generation: 1,
        lifecycleVersion: 1,
        progressVersion: 1,
        scoreVersion: 1,
        notesVersion: 1,
      });
      expect(entry.watchedEpisodes).toEqual([]);

      const liveState = await db.query<{ value: Record<string, unknown> }>(
        "select public.phase2c_read_entry_state(321) as value;",
      );
      expect(liveState.rows[0]!.value).toMatchObject({ status: "live" });
    } finally {
      await db.close();
    }
  });

  it("executes deterministic_anilist_media_id in PostgreSQL matching RFC 4122 UUIDv3 test vectors", async () => {
    const db = await createCleanDatabase();
    try {
      const res = await db.query<{
        id1: string;
        id21: string;
        id16498: string;
      }>(`
        select
          public.deterministic_anilist_media_id(1) as id1,
          public.deterministic_anilist_media_id(21) as id21,
          public.deterministic_anilist_media_id(16498) as id16498;
      `);

      const row = res.rows[0]!;
      expect(row.id1).toBe("bc1934ba-4c73-38ba-b848-61928124cb64");
      expect(row.id21).toBe("d2fbc542-0768-3a30-ab27-040f1dcdeb16");
      expect(row.id16498).toBe("6a94b024-3842-3a12-a716-0e91f47cfecb");

      // Verify RFC 4122 UUID format: version 3 in octet 6, variant 10xx in octet 8
      expect(row.id1[14]).toBe("3");
      expect(["8", "9", "a", "b"]).toContain(row.id1[19]);
    } finally {
      await db.close();
    }
  });

  it("executes backfill successfully with valid fixture data (anime, movie, manga)", async () => {
    const db = await createCleanDatabase();
    try {
      const testUserId = "11111111-1111-1111-1111-111111111111";
      await db.query(`insert into auth.users (id) values ('${testUserId}');`);

      // Seed catalog cache
      await db.query(`
        insert into public.catalog_cache (key, payload, cached_at, fresh_until, expires_at) values
          ('details:100', '{"format": "TV"}', now(), now() + interval '1 day', now() + interval '7 days'),
          ('details:200', '{"format": "MOVIE"}', now(), now() + interval '1 day', now() + interval '7 days');
      `);

      // Seed legacy user_anime (100 = TV anime, 200 = movie, 300 = manga)
      await db.query(`
        insert into public.user_anime (id, user_id, anilist_id, media_type, status, progress, volumes_progress, score) values
          ('10000000-0000-0000-0000-000000000001', '${testUserId}', 100, 'anime', 'watching', 5, 0, 8.5),
          ('10000000-0000-0000-0000-000000000002', '${testUserId}', 200, 'anime', 'completed', 1, 0, 9.0),
          ('10000000-0000-0000-0000-000000000003', '${testUserId}', 300, 'manga', 'completed', 25, 2, 8.0);
      `);

      // Seed legacy episode for TV anime
      await db.query(`
        insert into public.user_anime_episodes (id, user_id, anilist_id, episode_number, watched_at) values
          ('20000000-0000-0000-0000-000000000001', '${testUserId}', 100, 1, clock_timestamp());
      `);

      // Execute backfill
      const runId = "30000000-0000-0000-0000-000000000001";
      const backfillRes = await db.query<{ res: Record<string, unknown> }>(
        `select public.backfill_phase2b('${runId}'::uuid) as res;`,
      );
      const backfillRow = backfillRes.rows[0]!;
      expect(backfillRow.res.media_inserted).toBe(3);
      expect(backfillRow.res.user_media_inserted).toBe(3);
      expect(backfillRow.res.episodes_inserted).toBe(1);
      expect(backfillRow.res.issues).toBe(0);

      // Verify canonical tables
      const mediaRes = await db.query<{ id: string; kind: string }>(
        "select id, kind from public.media order by kind;",
      );
      expect(mediaRes.rows).toHaveLength(3);
      expect(mediaRes.rows.map((r) => r.kind)).toEqual(["anime", "manga", "movie"]);

      // Verify user_media kinds and progress
      const userMediaRes = await db.query<{
        media_kind: string;
        episodes_watched: number | null;
        movie_watched: boolean | null;
        chapters_read: number | null;
      }>("select media_kind, episodes_watched, movie_watched, chapters_read from public.user_media order by media_kind;");
      expect(userMediaRes.rows[0]!.media_kind).toBe("anime");
      expect(userMediaRes.rows[0]!.episodes_watched).toBe(5);

      expect(userMediaRes.rows[1]!.media_kind).toBe("manga");
      expect(userMediaRes.rows[1]!.chapters_read).toBe(25);

      expect(userMediaRes.rows[2]!.media_kind).toBe("movie");
      expect(userMediaRes.rows[2]!.movie_watched).toBe(true);

      // Verify user_media_episodes
      const epRes = await db.query<{ media_kind: string; episode_number: number }>(
        "select media_kind, episode_number from public.user_media_episodes;",
      );
      expect(epRes.rows).toHaveLength(1);
      expect(epRes.rows[0]!.media_kind).toBe("anime");
      expect(epRes.rows[0]!.episode_number).toBe(1);

      // Verify validate_phase2b reports clean health
      const valRes = await db.query<{ val: Record<string, unknown> }>(
        "select public.validate_phase2b() as val;",
      );
      const val = valRes.rows[0]!.val;
      expect(val.legacy_user_anime).toBe(3);
      expect(val.canonical_user_media).toBe(3);
      expect(val.legacy_user_anime_episodes).toBe(1);
      expect(val.canonical_user_media_episodes).toBe(1);
      expect(val.missing_media_fk).toBe(0);
      expect(val.invalid_progress_rows).toBe(0);
      expect(val.per_user_count_mismatches).toBe(0);
      expect(val.latest_run_id).toBe(runId);
      expect(val.latest_run_outcome).toBe("completed");
      expect(val.backfill_issues_latest_run).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("re-running backfill with a fresh run ID is completely idempotent", async () => {
    const db = await createCleanDatabase();
    try {
      const testUserId = "11111111-1111-1111-1111-111111111111";
      await db.query(`insert into auth.users (id) values ('${testUserId}');`);
      await db.query(`
        insert into public.catalog_cache (key, payload, cached_at, fresh_until, expires_at) values
          ('details:100', '{"format": "TV"}', now(), now() + interval '1 day', now() + interval '7 days');
      `);
      await db.query(`
        insert into public.user_anime (id, user_id, anilist_id, media_type, status, progress, volumes_progress) values
          ('10000000-0000-0000-0000-000000000001', '${testUserId}', 100, 'anime', 'watching', 5, 0);
      `);

      // Run 1
      await db.query("select public.backfill_phase2b();");

      const count1 = await db.query<{ count: string | number }>("select count(*) from public.user_media;");
      expect(Number(count1.rows[0]!.count)).toBe(1);

      // Run 2 with fresh run ID
      const secondRun = await db.query<{ res: Record<string, unknown> }>(
        "select public.backfill_phase2b() as res;",
      );
      expect(secondRun.rows[0]!.res.media_inserted).toBe(0);
      expect(secondRun.rows[0]!.res.user_media_inserted).toBe(0);
      expect(secondRun.rows[0]!.res.issues).toBe(0);

      const count2 = await db.query<{ count: string | number }>("select count(*) from public.user_media;");
      expect(Number(count2.rows[0]!.count)).toBe(1);
    } finally {
      await db.close();
    }
  });

  it("quarantines missing and malformed catalog cache metadata without crashing", async () => {
    const db = await createCleanDatabase();
    try {
      const testUserId = "11111111-1111-1111-1111-111111111111";
      await db.query(`insert into auth.users (id) values ('${testUserId}');`);

      // Missing cache for 500; malformed cache for 501
      await db.query(`
        insert into public.catalog_cache (key, payload, cached_at, fresh_until, expires_at) values
          ('details:501', '"not an object"', now(), now() + interval '1 day', now() + interval '7 days');
      `);
      await db.query(`
        insert into public.user_anime (id, user_id, anilist_id, media_type, status, progress, volumes_progress) values
          ('10000000-0000-0000-0000-000000000500', '${testUserId}', 500, 'anime', 'watching', 1, 0),
          ('10000000-0000-0000-0000-000000000501', '${testUserId}', 501, 'anime', 'watching', 1, 0);
      `);

      const backfillRes = await db.query<{ res: Record<string, unknown> }>(
        "select public.backfill_phase2b() as res;",
      );
      expect(backfillRes.rows[0]!.res.issues).toBe(2);

      const issuesRes = await db.query<{ reason: string; legacy_id: string }>(
        "select reason, legacy_id from public.media_backfill_issues order by legacy_id;",
      );
      expect(issuesRes.rows).toHaveLength(2);
      expect(issuesRes.rows[0]!.reason).toBe("missing-catalog-cache");
      expect(issuesRes.rows[1]!.reason).toBe("malformed-catalog-cache");

      // Valid records were not falsely inserted
      const userMediaCount = await db.query<{ count: string | number }>("select count(*) from public.user_media;");
      expect(Number(userMediaCount.rows[0]!.count)).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("quarantines conflicting library and episode records and enforces kind constraints", async () => {
    const db = await createCleanDatabase();
    try {
      const testUserId = "11111111-1111-1111-1111-111111111111";
      await db.query(`insert into auth.users (id) values ('${testUserId}');`);
      await db.query(`
        insert into public.catalog_cache (key, payload, cached_at, fresh_until, expires_at) values
          ('details:600', '{"format": "MOVIE"}', now(), now() + interval '1 day', now() + interval '7 days');
      `);

      // User anime 600 is a movie
      await db.query(`
        insert into public.user_anime (id, user_id, anilist_id, media_type, status, progress, volumes_progress) values
          ('10000000-0000-0000-0000-000000000600', '${testUserId}', 600, 'anime', 'completed', 1, 0);
      `);

      // Invalid episode attached to movie 600
      await db.query(`
        insert into public.user_anime_episodes (id, user_id, anilist_id, episode_number, watched_at) values
          ('20000000-0000-0000-0000-000000000600', '${testUserId}', 600, 1, clock_timestamp());
      `);

      await db.query("select public.backfill_phase2b();");

      const issueRes = await db.query<{ reason: string }>(
        "select reason from public.media_backfill_issues where reason = 'movie-episode-history';",
      );
      expect(issueRes.rows).toHaveLength(1);

      // Episode was quarantined and NOT inserted into user_media_episodes
      const epCount = await db.query<{ count: string | number }>("select count(*) from public.user_media_episodes;");
      expect(Number(epCount.rows[0]!.count)).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("rolls back every write from a real backfill_phase2b() execution aborted mid-run", async () => {
    const db = await createCleanDatabase();
    try {
      const testUserId = "11111111-1111-1111-1111-111111111111";
      await db.query(`insert into auth.users (id) values ('${testUserId}');`);
      await db.query(`
        insert into public.catalog_cache (key, payload, cached_at, fresh_until, expires_at) values
          ('details:100', '{"format": "TV"}', now(), now() + interval '1 day', now() + interval '7 days');
      `);

      // 100 migrates as an anime with one episode. 500 has no catalog cache, so the run
      // also writes a quarantine issue before the injected failure, giving all four
      // canonical ledger tables something to roll back.
      await db.query(`
        insert into public.user_anime (id, user_id, anilist_id, media_type, status, progress, volumes_progress) values
          ('10000000-0000-0000-0000-000000000001', '${testUserId}', 100, 'anime', 'watching', 5, 0),
          ('10000000-0000-0000-0000-000000000500', '${testUserId}', 500, 'anime', 'watching', 1, 0);
      `);
      await db.query(`
        insert into public.user_anime_episodes (id, user_id, anilist_id, episode_number, watched_at) values
          ('20000000-0000-0000-0000-000000000001', '${testUserId}', 100, 1, clock_timestamp());
      `);

      // Fail inside the function itself, at the episode insert that runs after the media,
      // external-id, user_media and issue writes have already executed. The trigger reports the
      // counts it observes so the test can prove those writes existed inside the transaction.
      await db.exec(`
        create or replace function public.phase2b_force_episode_failure() returns trigger
        language plpgsql
        as $$
        declare
          v_media integer;
          v_external_ids integer;
          v_user_media integer;
          v_issues integer;
        begin
          select count(*) into v_media from public.media;
          select count(*) into v_external_ids from public.media_external_ids;
          select count(*) into v_user_media from public.user_media;
          select count(*) into v_issues from public.media_backfill_issues;
          raise exception 'forced failure during episode migration (media=%, external_ids=%, user_media=%, issues=%)',
            v_media, v_external_ids, v_user_media, v_issues
            using errcode = 'XX000';
        end;
        $$;

        create trigger phase2b_force_episode_failure
          before insert on public.user_media_episodes
          for each row execute function public.phase2b_force_episode_failure();
      `);

      const abortedRunId = "40000000-0000-0000-0000-000000000001";
      let failure: unknown;
      try {
        await db.exec(`begin; select public.backfill_phase2b('${abortedRunId}'::uuid);`);
      } catch (error) {
        failure = error;
      }

      // The trigger's report proves the aborted transaction had already written media, an
      // external id, a library row and at least one quarantine issue, so the zero counts
      // asserted after rollback describe real backfill work rather than an empty run.
      const triggerReport =
        /media=(\d+), external_ids=(\d+), user_media=(\d+), issues=(\d+)/.exec(String(failure));
      expect(triggerReport).not.toBeNull();
      if (!triggerReport) {
        throw new Error(`expected trigger report in failure: ${String(failure)}`);
      }
      const [, mediaAtFailure, externalIdsAtFailure, userMediaAtFailure, issuesAtFailure] =
        triggerReport;
      expect(Number(mediaAtFailure)).toBe(1);
      expect(Number(externalIdsAtFailure)).toBe(1);
      expect(Number(userMediaAtFailure)).toBe(1);
      // The uncached library row (anilist 500) is already quarantined before the episode insert.
      expect(Number(issuesAtFailure)).toBeGreaterThanOrEqual(1);
      await db.exec("rollback;");

      const rolledBack = await db.query<Record<string, number>>(`
        select
          (select count(*)::int from public.media) as media,
          (select count(*)::int from public.media_external_ids) as external_ids,
          (select count(*)::int from public.user_media) as user_media,
          (select count(*)::int from public.user_media_episodes) as episodes,
          (select count(*)::int from public.media_backfill_issues) as issues,
          (select count(*)::int from public.media_backfill_runs) as runs;
      `);
      expect(rolledBack.rows[0]).toEqual({
        media: 0,
        external_ids: 0,
        user_media: 0,
        episodes: 0,
        issues: 0,
        runs: 0,
      });

      // Legacy rows are never mutated, not even by the aborted execution.
      const legacy = await db.query<Record<string, number>>(`
        select
          (select count(*)::int from public.user_anime) as library,
          (select count(*)::int from public.user_anime_episodes) as episodes;
      `);
      expect(legacy.rows[0]).toEqual({ library: 2, episodes: 1 });

      // Re-running the same fixture without the injected failure succeeds, which proves the
      // rollback assertions above describe valid backfill work rather than a broken fixture.
      await db.exec("drop trigger phase2b_force_episode_failure on public.user_media_episodes;");
      const retry = await db.query<{ res: Record<string, number> }>(
        "select public.backfill_phase2b('40000000-0000-0000-0000-000000000002'::uuid) as res;",
      );
      expect(retry.rows[0]!.res.media_inserted).toBe(1);
      expect(retry.rows[0]!.res.user_media_inserted).toBe(1);
      expect(retry.rows[0]!.res.episodes_inserted).toBe(1);
      expect(retry.rows[0]!.res.issues).toBe(1);
    } finally {
      await db.close();
    }
  });

  it("records a pre-registered run as failed when the real backfill execution aborts, leaving no canonical data", async () => {
    const db = await createCleanDatabase();
    try {
      const testUserId = "11111111-1111-1111-1111-111111111111";
      const runId = "50000000-0000-0000-0000-000000000001";
      await db.query(`insert into auth.users (id) values ('${testUserId}');`);
      await db.query(`
        insert into public.catalog_cache (key, payload, cached_at, fresh_until, expires_at) values
          ('details:100', '{"format": "TV"}', now(), now() + interval '1 day', now() + interval '7 days');
      `);
      await db.query(`
        insert into public.user_anime (id, user_id, anilist_id, media_type, status, progress, volumes_progress) values
          ('10000000-0000-0000-0000-000000000001', '${testUserId}', 100, 'anime', 'watching', 5, 0),
          ('10000000-0000-0000-0000-000000000500', '${testUserId}', 500, 'anime', 'watching', 1, 0);
      `);
      await db.query(`
        insert into public.user_anime_episodes (id, user_id, anilist_id, episode_number, watched_at) values
          ('20000000-0000-0000-0000-000000000001', '${testUserId}', 100, 1, clock_timestamp());
      `);

      // Transaction 1: the orchestrator pre-registers the run and commits.
      await db.exec(`
        begin;
        insert into public.media_backfill_runs (id, started_at, outcome, details)
        values (
          '${runId}',
          clock_timestamp(),
          'running',
          jsonb_build_object('orchestrator', 'kaze-migration-runner')
        );
        commit;
      `);

      const registered = await db.query<{ outcome: string; started_at: string }>(
        `select outcome, started_at::text as started_at from public.media_backfill_runs where id = '${runId}';`,
      );
      expect(registered.rows[0]!.outcome).toBe("running");

      // Fail inside the real function, after it has written media, external IDs, the library
      // row and a quarantine issue for the run.
      await db.exec(`
        create or replace function public.phase2b_force_episode_failure() returns trigger
        language plpgsql
        as $$
        declare
          v_media integer;
          v_user_media integer;
        begin
          select count(*) into v_media from public.media;
          select count(*) into v_user_media from public.user_media;
          raise exception 'forced failure during episode migration (media=%, user_media=%)', v_media, v_user_media
            using errcode = 'XX000';
        end;
        $$;

        create trigger phase2b_force_episode_failure
          before insert on public.user_media_episodes
          for each row execute function public.phase2b_force_episode_failure();
      `);

      // Transaction 2: execute the real backfill against the pre-registered run; it fails and
      // the whole execution transaction rolls back.
      let failure: unknown;
      try {
        await db.exec(`begin; select public.backfill_phase2b('${runId}'::uuid);`);
      } catch (error) {
        failure = error;
      }
      expect(String(failure)).toContain(
        "forced failure during episode migration (media=1, user_media=1)",
      );
      await db.exec("rollback;");

      // Transaction 1's committed ledger row survives untouched: the function's own update to
      // 'completed' was rolled back with the rest of Transaction 2.
      const surviving = await db.query<{
        outcome: string;
        completed_at: string | null;
        started_at: string;
      }>(
        `select outcome, completed_at::text as completed_at, started_at::text as started_at
         from public.media_backfill_runs where id = '${runId}';`,
      );
      expect(surviving.rows).toHaveLength(1);
      expect(surviving.rows[0]!.outcome).toBe("running");
      expect(surviving.rows[0]!.completed_at).toBeNull();
      expect(surviving.rows[0]!.started_at).toBe(registered.rows[0]!.started_at);

      // No partial canonical data, mapping, episode or issue from Transaction 2 remains.
      const afterRollback = await db.query<Record<string, number>>(`
        select
          (select count(*)::int from public.media) as media,
          (select count(*)::int from public.media_external_ids) as external_ids,
          (select count(*)::int from public.user_media) as user_media,
          (select count(*)::int from public.user_media_episodes) as episodes,
          (select count(*)::int from public.media_backfill_issues) as issues,
          (select count(*)::int from public.media_backfill_runs) as runs;
      `);
      expect(afterRollback.rows[0]).toEqual({
        media: 0,
        external_ids: 0,
        user_media: 0,
        episodes: 0,
        issues: 0,
        runs: 1,
      });

      // Transaction 3: the orchestrator records the failure in a separate committed transaction.
      await db.exec(`
        begin;
        update public.media_backfill_runs
        set
          completed_at = clock_timestamp(),
          outcome = 'failed',
          details = coalesce(details, '{}'::jsonb) || jsonb_build_object(
            'error', 'forced failure during episode migration',
            'sqlstate', 'XX000'
          )
        where id = '${runId}' and outcome = 'running';
        commit;
      `);

      const finalCheck = await db.query<{
        outcome: string;
        details: { orchestrator: string; error: string; sqlstate: string };
      }>(
        `select outcome, details from public.media_backfill_runs where id = '${runId}';`,
      );
      expect(finalCheck.rows[0]!.outcome).toBe("failed");
      expect(finalCheck.rows[0]!.details.orchestrator).toBe("kaze-migration-runner");
      expect(finalCheck.rows[0]!.details.error).toBe("forced failure during episode migration");
      expect(finalCheck.rows[0]!.details.sqlstate).toBe("XX000");

      const valRes = await db.query<{ val: Record<string, unknown> }>(
        "select public.validate_phase2b() as val;",
      );
      const val = valRes.rows[0]!.val;
      expect(val.latest_run_id).toBe(runId);
      expect(val.latest_run_outcome).toBe("failed");
      expect(val.canonical_user_media).toBe(0);
      expect(val.media_rows).toBe(0);
      expect(val.backfill_issues).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("rejects run ID reuse for completed and failed runs with check_violation exception", async () => {
    const db = await createCleanDatabase();
    try {
      const completedRunId = "60000000-0000-0000-0000-000000000001";

      // First run succeeds
      await db.query(`select public.backfill_phase2b('${completedRunId}'::uuid);`);

      // Attempting to reuse completed run ID throws check_violation
      await expect(
        db.query(`select public.backfill_phase2b('${completedRunId}'::uuid);`),
      ).rejects.toThrow(/has already completed and cannot be reused/i);

      // Pre-register and mark another run as failed
      const failedRunId = "60000000-0000-0000-0000-000000000002";
      await db.query(`
        insert into public.media_backfill_runs (id, started_at, completed_at, outcome)
        values ('${failedRunId}', clock_timestamp(), clock_timestamp(), 'failed');
      `);

      // Attempting to reuse failed run ID throws check_violation
      await expect(
        db.query(`select public.backfill_phase2b('${failedRunId}'::uuid);`),
      ).rejects.toThrow(/has already failed and cannot be reused/i);
    } finally {
      await db.close();
    }
  });

  it("documents that PGlite cannot exercise run-ledger lock contention, and pins the lock ordering", async () => {
    const db = await createCleanDatabase();
    try {
      // PGlite embeds a single-session PostgreSQL: every statement runs through one serialized
      // connection, so two transactions can never be open at once and a row lock can never be
      // observed as contended. Genuine concurrency coverage is therefore NOT possible here; the
      // two-session verification procedure lives in docs/architecture/phase-2b-migration-recovery.md.
      const sessions = await db.query<{ backend_count: number }>(
        "select count(*)::int as backend_count from pg_stat_activity;",
      );
      expect(sessions.rows[0]!.backend_count).toBe(1);

      // What can be pinned is the contract the lock depends on: backfill_phase2b() must take the
      // run row lock before any canonical write, so a real PostgreSQL runner blocks on it.
      const fn = await db.query<{ src: string }>(
        "select prosrc as src from pg_proc where proname = 'backfill_phase2b';",
      );
      expect(fn.rows).toHaveLength(1);
      const src = fn.rows[0]!.src;
      const lockPosition = src.indexOf("for update");
      expect(lockPosition).toBeGreaterThan(-1);
      expect(src.slice(0, lockPosition)).toMatch(
        /select\s+outcome\s+into\s+v_existing_outcome\s+from\s+public\.media_backfill_runs/i,
      );
      expect(lockPosition).toBeLessThan(src.indexOf("insert into public.media_backfill_runs"));
      expect(lockPosition).toBeLessThan(src.indexOf("insert into public.media (id, kind)"));
      expect(lockPosition).toBeLessThan(src.indexOf("insert into public.user_media ("));
    } finally {
      await db.close();
    }
  });
});
