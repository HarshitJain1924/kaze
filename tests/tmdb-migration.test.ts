import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const MIGRATIONS = [
  "20261018000000_create_user_anime.sql",
  "20261115000000_create_tmdb_library.sql",
];

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";

async function createDatabase(): Promise<PGlite> {
  const db = new PGlite();

  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema if not exists auth;
    create table auth.users (id uuid primary key);
    create or replace function auth.uid() returns uuid
      language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
    insert into auth.users (id) values ('${USER_A}'), ('${USER_B}');
  `);

  for (const filename of MIGRATIONS) {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations", filename),
      "utf-8",
    );
    await db.exec(sql);
  }

  return db;
}

describe("TMDB library migration", () => {
  it("enforces owner RLS and cascades episode history", async () => {
    const db = await createDatabase();

    try {
      await db.exec(`set role authenticated`);

      await db.query(
        `select set_config('request.jwt.claim.sub', '${USER_A}', false)`,
      );
      await db.query(
        `insert into public.user_tmdb_entries
           (user_id, tmdb_id, media_type, title, total_episodes)
         values ($1, 1396, 'tv', 'Breaking Bad', 62)`,
        [USER_A],
      );

      const own = await db.query<{ count: number }>(
        `select count(*)::int as count from public.user_tmdb_entries`,
      );
      expect(own.rows[0]?.count).toBe(1);

      // Another signed-in user cannot see the row.
      await db.query(
        `select set_config('request.jwt.claim.sub', '${USER_B}', false)`,
      );
      const other = await db.query<{ count: number }>(
        `select count(*)::int as count from public.user_tmdb_entries`,
      );
      expect(other.rows[0]?.count).toBe(0);

      // Another user cannot forge an entry for user A.
      await expect(
        db.query(
          `insert into public.user_tmdb_entries
             (user_id, tmdb_id, media_type, title)
           values ($1, 603, 'movie', 'The Matrix')`,
          [USER_A],
        ),
      ).rejects.toThrow();

      // User A marks an episode, then deleting the entry cascades history.
      await db.query(
        `select set_config('request.jwt.claim.sub', '${USER_A}', false)`,
      );
      const entry = await db.query<{ id: string }>(
        `select id from public.user_tmdb_entries where user_id = $1`,
        [USER_A],
      );
      const entryId = entry.rows[0]?.id;
      expect(entryId).toBeTruthy();

      await db.query(
        `insert into public.user_tmdb_episodes
           (entry_id, user_id, season_number, episode_number)
         values ($1, $2, 1, 1)`,
        [entryId, USER_A],
      );

      const episodes = await db.query<{ count: number }>(
        `select count(*)::int as count from public.user_tmdb_episodes`,
      );
      expect(episodes.rows[0]?.count).toBe(1);

      await db.query(
        `delete from public.user_tmdb_entries where id = $1 and user_id = $2`,
        [entryId, USER_A],
      );

      const remaining = await db.query<{ count: number }>(
        `select count(*)::int as count from public.user_tmdb_episodes`,
      );
      expect(remaining.rows[0]?.count).toBe(0);
    } finally {
      await db.close();
    }
  }, 30_000);

  it("rejects invalid media kinds and duplicate user/title rows", async () => {
    const db = await createDatabase();

    try {
      await db.exec(`set role authenticated`);
      await db.query(
        `select set_config('request.jwt.claim.sub', '${USER_A}', false)`,
      );

      await expect(
        db.query(
          `insert into public.user_tmdb_entries
             (user_id, tmdb_id, media_type, title)
           values ($1, 1, 'anime', 'Wrong kind')`,
          [USER_A],
        ),
      ).rejects.toThrow();

      await db.query(
        `insert into public.user_tmdb_entries
           (user_id, tmdb_id, media_type, title)
         values ($1, 603, 'movie', 'The Matrix')`,
        [USER_A],
      );

      await expect(
        db.query(
          `insert into public.user_tmdb_entries
             (user_id, tmdb_id, media_type, title)
           values ($1, 603, 'movie', 'The Matrix again')`,
          [USER_A],
        ),
      ).rejects.toThrow();
    } finally {
      await db.close();
    }
  }, 30_000);
});
