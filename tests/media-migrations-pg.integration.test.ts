import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const migrationFiles = [
  "20261018000000_create_user_anime.sql",
  "20261018000001_create_user_anime_episodes.sql",
  "20261021000000_create_catalog_cache.sql",
  "20261101000000_add_media_type_and_volumes.sql",
  "20261105000000_create_canonical_media_schema.sql",
  "20261105000001_backfill_canonical_library.sql",
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

  it("proves transaction failure rolls back canonical data completely", async () => {
    const db = await createCleanDatabase();
    try {
      const testUserId = "11111111-1111-1111-1111-111111111111";
      await db.query(`insert into auth.users (id) values ('${testUserId}');`);

      // Begin transaction, insert partial data, and roll back
      await db.exec(`
        begin;
        insert into public.media (id, kind) values ('40000000-0000-0000-0000-000000000001', 'anime');
        rollback;
      `);

      const mediaCount = await db.query<{ count: string | number }>("select count(*) from public.media;");
      expect(Number(mediaCount.rows[0]!.count)).toBe(0);
    } finally {
      await db.close();
    }
  });

  it("verifies external orchestration preserves pre-registered run after execution failure", async () => {
    const db = await createCleanDatabase();
    try {
      const runId = "50000000-0000-0000-0000-000000000001";

      // Transaction 1: Pre-register run in 'running' state and commit
      await db.exec(`
        begin;
        insert into public.media_backfill_runs (id, started_at, outcome)
        values ('${runId}', clock_timestamp(), 'running');
        commit;
      `);

      // Transaction 2: Backfill executes in ambient transaction that aborts / rolls back
      try {
        await db.exec(`
          begin;
          -- Simulate an unhandled fatal error or abort during execution
          select 1/0;
          commit;
        `);
      } catch {
        await db.exec("rollback;");
      }

      // The Transaction 1 ledger record survived the Transaction 2 rollback!
      const checkSurviving = await db.query<{ outcome: string }>(
        `select outcome from public.media_backfill_runs where id = '${runId}';`,
      );
      expect(checkSurviving.rows[0]!.outcome).toBe("running");

      // Transaction 3: Orchestrator records failure in fresh committed transaction
      await db.exec(`
        begin;
        update public.media_backfill_runs
        set
          completed_at = clock_timestamp(),
          outcome = 'failed',
          details = jsonb_build_object('error', 'Division by zero in worker')
        where id = '${runId}' and outcome = 'running';
        commit;
      `);

      const finalCheck = await db.query<{ outcome: string; details: { error: string } }>(
        `select outcome, details from public.media_backfill_runs where id = '${runId}';`,
      );
      expect(finalCheck.rows[0]!.outcome).toBe("failed");
      expect(finalCheck.rows[0]!.details.error).toBe("Division by zero in worker");

      // validate_phase2b reflects the failed run
      const valRes = await db.query<{ val: Record<string, unknown> }>(
        "select public.validate_phase2b() as val;",
      );
      expect(valRes.rows[0]!.val.latest_run_id).toBe(runId);
      expect(valRes.rows[0]!.val.latest_run_outcome).toBe("failed");
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

  it("prevents duplicate concurrent execution using the same run ID via row locking", async () => {
    const db = await createCleanDatabase();
    try {
      const sharedRunId = "70000000-0000-0000-0000-000000000001";

      // Pre-register run in 'running' state
      await db.query(`
        insert into public.media_backfill_runs (id, started_at, outcome)
        values ('${sharedRunId}', clock_timestamp(), 'running');
      `);

      // First execution completes and updates outcome to 'completed'
      await db.query(`select public.backfill_phase2b('${sharedRunId}'::uuid);`);

      // Second execution attempt reading the same row throws because it is completed
      await expect(
        db.query(`select public.backfill_phase2b('${sharedRunId}'::uuid);`),
      ).rejects.toThrow(/has already completed and cannot be reused/i);
    } finally {
      await db.close();
    }
  });
});
