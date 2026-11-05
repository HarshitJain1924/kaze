import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schemaSqlPath = resolve(
  __dirname,
  "../supabase/migrations/20261105000000_create_canonical_media_schema.sql",
);
const backfillSqlPath = resolve(
  __dirname,
  "../supabase/migrations/20261105000001_backfill_canonical_library.sql",
);

const schemaSql = readFileSync(schemaSqlPath, "utf-8");
const backfillSql = readFileSync(backfillSqlPath, "utf-8");

describe("Static SQL Migration Verification", () => {
  describe("20261105000000_create_canonical_media_schema.sql", () => {
    it("preserves legacy tables and does not drop or alter them", () => {
      expect(schemaSql).not.toMatch(/drop\s+table\s+.*user_anime/i);
      expect(schemaSql).not.toMatch(/drop\s+table\s+.*catalog_cache/i);
      expect(schemaSql).not.toMatch(/alter\s+table\s+.*user_anime\s+drop/i);
    });

    it("enforces valid canonical media kinds", () => {
      expect(schemaSql).toMatch(
        /check\s*\(\s*kind\s+in\s*\('anime',\s*'manga',\s*'movie',\s*'tv'\)\s*\)/i,
      );
    });

    it("defines composite unique key on user_media (id, user_id, media_kind)", () => {
      expect(schemaSql).toMatch(
        /constraint\s+user_media_id_user_kind_key\s+unique\s*\(\s*id,\s*user_id,\s*media_kind\s*\)/i,
      );
    });

    it("defines media_kind discriminator on user_media_episodes restricted to anime and tv", () => {
      expect(schemaSql).toMatch(/media_kind\s+text\s+not\s+null\s+default\s+'anime'/i);
      expect(schemaSql).toMatch(
        /constraint\s+user_media_episodes_media_kind_valid\s+check\s*\(\s*media_kind\s+in\s*\('anime',\s*'tv'\)\s*\)/i,
      );
    });

    it("enforces declarative composite foreign key from user_media_episodes to user_media", () => {
      expect(schemaSql).toMatch(
        /constraint\s+user_media_episodes_owner_kind_fk\s+foreign\s+key\s*\(\s*user_media_id,\s*user_id,\s*media_kind\s*\)\s+references\s+public\.user_media\s*\(\s*id,\s*user_id,\s*media_kind\s*\)\s+on\s+delete\s+cascade/i,
      );
    });

    it("creates index on user_media_episodes (media_kind)", () => {
      expect(schemaSql).toMatch(
        /create\s+index\s+if\s+not\s+exists\s+user_media_episodes_media_kind_idx\s+on\s+public\.user_media_episodes\s*\(\s*media_kind\s*\)/i,
      );
    });

    it("creates media_backfill_runs invocation ledger with outcome constraint and started_at index", () => {
      expect(schemaSql).toMatch(/create\s+table\s+if\s+not\s+exists\s+public\.media_backfill_runs/i);
      expect(schemaSql).toMatch(
        /constraint\s+media_backfill_runs_outcome_valid\s+check\s*\(\s*outcome\s+in\s*\('running',\s*'completed',\s*'failed'\)\s*\)/i,
      );
      expect(schemaSql).toMatch(
        /create\s+index\s+if\s+not\s+exists\s+media_backfill_runs_started_idx\s+on\s+public\.media_backfill_runs\s*\(\s*started_at\s+desc\s*\)/i,
      );
    });

    it("creates media_backfill_issues quarantine table referencing media_backfill_runs", () => {
      expect(schemaSql).toMatch(/create\s+table\s+if\s+not\s+exists\s+public\.media_backfill_issues/i);
      expect(schemaSql).toMatch(
        /constraint\s+media_backfill_issues_run_fk\s+foreign\s+key\s*\(\s*run_id\s*\)\s+references\s+public\.media_backfill_runs\s*\(\s*id\s*\)\s+on\s+delete\s+cascade/i,
      );
      expect(schemaSql).toMatch(
        /constraint\s+media_backfill_issues_run_legacy_reason_key\s+unique\s*\(\s*run_id,\s*legacy_table,\s*legacy_id,\s*reason\s*\)/i,
      );
    });
  });

  describe("20261105000001_backfill_canonical_library.sql", () => {
    it("preserves legacy tables and does not drop or alter them", () => {
      expect(backfillSql).not.toMatch(/drop\s+table\s+public\.user_anime/i);
      expect(backfillSql).not.toMatch(/drop\s+table\s+public\.catalog_cache/i);
      expect(backfillSql).not.toMatch(/truncate\s+.*user_anime/i);
    });

    it("defines deterministic_anilist_media_id using standard RFC 4122 UUIDv3 without UUIDv5 claims", () => {
      expect(backfillSql).toMatch(/create\s+or\s+replace\s+function\s+public\.deterministic_anilist_media_id/i);
      expect(backfillSql).toContain("6ba7b8119dad11d180b400c04fd430c8");
      expect(backfillSql).toContain("UUIDv3");
      expect(backfillSql).not.toContain("UUIDv5");
    });

    it("extracts format from catalog_cache details and summary keys", () => {
      expect(backfillSql).toContain("regexp_match(c.key, '^(?:details|summary):([0-9]+)$')");
      expect(backfillSql).toContain("c.payload->>'format'");
    });

    it("classifies AniList MOVIE format as canonical movie", () => {
      expect(backfillSql).toMatch(/when\s+cf\.resolved_format\s*=\s*'MOVIE'\s+then\s*'movie'/i);
      expect(backfillSql).toMatch(
        /case\s+when\s+vl\.media_kind\s*=\s*'movie'\s+then\s*\(vl\.status\s*=\s*'completed'\s+or\s+vl\.progress\s*>=\s*1\)\s+else\s+null\s+end/i,
      );
    });

    it("quarantines missing, malformed, and conflicting catalog cache metadata", () => {
      expect(backfillSql).toContain("'missing-catalog-cache'");
      expect(backfillSql).toContain("'conflicting-catalog-cache'");
      expect(backfillSql).toContain("'malformed-catalog-cache'");
      expect(backfillSql).toContain("'conflicting-media-kind-cache'");
    });

    it("quarantines episode history attached to movies or manga", () => {
      expect(backfillSql).toContain("'movie-episode-history'");
      expect(backfillSql).toContain("'manga-episode-history'");
    });

    it("detects and quarantines field-level conflicts with existing canonical and library rows", () => {
      expect(backfillSql).toContain("'conflicting-canonical-media-kind'");
      expect(backfillSql).toContain("'conflicting-provider-mapping'");
      expect(backfillSql).toContain("'conflicting-library-user-ownership'");
      expect(backfillSql).toContain("'conflicting-library-media-id'");
      expect(backfillSql).toContain("'conflicting-library-media-kind'");
      expect(backfillSql).toContain("'conflicting-library-progress'");
      expect(backfillSql).toContain("'conflicting-library-status'");
      expect(backfillSql).toContain("'conflicting-library-score'");
      expect(backfillSql).toContain("'conflicting-library-notes'");
      expect(backfillSql).toContain("'conflicting-library-favorite'");
      expect(backfillSql).toContain("'conflicting-library-dates'");
      expect(backfillSql).toContain("'conflicting-library-timestamps'");
      expect(backfillSql).toContain("'conflicting-alternate-key-library'");
      expect(backfillSql).toContain("'conflicting-episode-parent'");
      expect(backfillSql).toContain("'conflicting-episode-user-ownership'");
      expect(backfillSql).toContain("'conflicting-episode-number'");
      expect(backfillSql).toContain("'conflicting-episode-watched-at'");
      expect(backfillSql).toContain("'conflicting-episode-created-at'");
      expect(backfillSql).toContain("'conflicting-alternate-key-episode'");
      // Identical alternate-key matches are idempotent matches, NOT conflicts
      expect(backfillSql).not.toContain("'conflicting-alternate-key-id'");
      expect(backfillSql).not.toContain("'conflicting-alternate-key-episode-id'");
    });

    it("sets media_kind = 'anime' on user_media_episodes insertion", () => {
      expect(backfillSql).toMatch(
        /insert\s+into\s+public\.user_media_episodes\s*\([^)]*media_kind[^)]*\)/i,
      );
      expect(backfillSql).toMatch(/select\s+[^,]+,\s*[^,]+,\s*[^,]+,\s*'anime',/i);
    });

    it("provides auto-resolution of issues on rerun when metadata becomes available", () => {
      expect(backfillSql).toMatch(
        /update\s+public\.media_backfill_issues\s+set\s+resolved_at\s*=\s*now\(\)/i,
      );
      expect(backfillSql).toContain("'missing-catalog-cache'");
      expect(backfillSql).toContain("'malformed-catalog-cache'");
      expect(backfillSql).toContain("'conflicting-catalog-cache'");
    });

    it("records run in media_backfill_runs at start and updates completion outcome", () => {
      expect(backfillSql).toMatch(
        /insert\s+into\s+public\.media_backfill_runs\s*\(\s*id,\s*started_at,\s*outcome\s*\)/i,
      );
      expect(backfillSql).toMatch(
        /update\s+public\.media_backfill_runs\s+set\s+completed_at\s*=\s*clock_timestamp\(\),\s*outcome\s*=\s*'completed'/i,
      );
    });

    it("separates schema installation from backfill execution without auto-invoking backfill", () => {
      const executableStatements = backfillSql
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n");
      expect(executableStatements).not.toMatch(/select\s+public\.backfill_phase2b\s*\(/i);
    });

    it("rejects unsafe run ID reuse for completed and failed runs with row locking", () => {
      expect(backfillSql).toMatch(
        /select\s+outcome\s+into\s+v_existing_outcome\s+from\s+public\.media_backfill_runs\s+where\s+id\s*=\s*p_run_id\s+for\s+update/i,
      );
      expect(backfillSql).toMatch(
        /raise\s+exception\s+'Run ID % has already completed and cannot be reused\.'/i,
      );
      expect(backfillSql).toMatch(
        /raise\s+exception\s+'Run ID % has already failed and cannot be reused\. Retries must use a new run ID\.'/i,
      );
    });

    it("defines validate_phase2b() with comprehensive data integrity and run ledger checks", () => {
      expect(backfillSql).toMatch(/create\s+or\s+replace\s+function\s+public\.validate_phase2b\(\)/i);
      expect(backfillSql).toMatch(/from\s+public\.media_backfill_runs/i);
      expect(backfillSql).toContain("'latest_run_id'");
      expect(backfillSql).toContain("'latest_run_outcome'");
      expect(backfillSql).toContain("'invalid_progress_rows'");
      expect(backfillSql).toContain("'orphan_canonical_episodes'");
      expect(backfillSql).toContain("'duplicate_external_id_groups'");
      expect(backfillSql).toContain("'missing_media_fk'");
      expect(backfillSql).toContain("'per_user_count_mismatches'");
      expect(backfillSql).toContain("'backfill_issues_total_historical'");
      expect(backfillSql).toContain("'backfill_issues_unresolved'");
      expect(backfillSql).toContain("'backfill_issues_resolved'");
      expect(backfillSql).toContain("'backfill_issues_latest_run'");
      expect(backfillSql).toContain("'backfill_issues_latest_run_unresolved'");
      expect(backfillSql).toContain("'backfill_issues'");
    });
  });
});
