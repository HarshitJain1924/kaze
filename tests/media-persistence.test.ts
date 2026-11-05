import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertMediaLibraryItem,
  deterministicAniListMediaId,
  planLegacyBackfill,
  summarizeBackfillIssues,
  validateBackfillRunReuse,
  validateMediaLibraryEntry,
  ANILIST_UUID_NAMESPACE,
  MediaLibraryInvariantError,
  type BackfillIssueRecord,
  type BackfillRunRecord,
  type BackfillOptions,
  type CatalogCacheEntry,
  type LegacyUserAnimeEpisodeRow,
  type LegacyUserAnimeRow,
} from "@/lib/media/persistence";
import {
  toCanonicalMediaId,
  type CanonicalMediaId,
  type MediaEpisodeProgress,
  type MediaLibraryEntry,
  type MediaSummary,
} from "@/types/media";

const TEST_MEDIA_UUID = "123e4567-e89b-42d3-a456-426614174000";
const OTHER_MEDIA_UUID = "223e4567-e89b-42d3-a456-426614174000";

function mediaId(value: string = TEST_MEDIA_UUID): CanonicalMediaId {
  const id = toCanonicalMediaId(value);
  if (!id) throw new Error(`Invalid test media id: ${value}`);
  return id;
}

function makeLegacyAnime(
  id: string,
  anilistId: number,
  overrides: Partial<LegacyUserAnimeRow> = {},
): LegacyUserAnimeRow {
  return {
    id,
    userId: "user-1",
    anilistId,
    mediaType: "anime",
    status: "watching",
    progress: 5,
    volumesProgress: 0,
    score: 8,
    startedAt: "2026-01-01",
    completedAt: null,
    notes: "A note",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeLegacyEpisode(
  id: string,
  anilistId: number,
  episodeNumber: number,
  overrides: Partial<LegacyUserAnimeEpisodeRow> = {},
): LegacyUserAnimeEpisodeRow {
  return {
    id,
    userId: "user-1",
    anilistId,
    episodeNumber,
    watchedAt: "2026-01-01T12:00:00.000Z",
    createdAt: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}

describe("1. Episode history media-kind enforcement", () => {
  it("accepts episode history for an anime entry", () => {
    const userAnime = [makeLegacyAnime("lib-1", 101)];
    const episodes = [makeLegacyEpisode("ep-1", 101, 1)];
    const options: BackfillOptions = {
      catalogCache: new Map([[101, { format: "TV" }]]),
    };

    const plan = planLegacyBackfill(userAnime, episodes, options);
    expect(plan.issues).toHaveLength(0);
    expect(plan.episodes).toHaveLength(1);
    expect(plan.episodes[0]).toMatchObject({
      id: "ep-1",
      userId: "user-1",
      userMediaId: "lib-1",
      mediaKind: "anime",
      episodeNumber: 1,
    });
  });

  it("rejects episode history attached to a movie entry", () => {
    const userAnime = [makeLegacyAnime("lib-movie", 202)];
    const episodes = [makeLegacyEpisode("ep-movie", 202, 1)];
    const options: BackfillOptions = {
      catalogCache: new Map([[202, { format: "MOVIE" }]]),
    };

    const plan = planLegacyBackfill(userAnime, episodes, options);
    expect(plan.userMedia[0]?.mediaKind).toBe("movie");
    expect(plan.episodes).toHaveLength(0);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime_episodes",
        legacyId: "ep-movie",
        reason: "movie-episode-history",
      }),
    );
  });

  it("rejects episode history attached to a manga entry", () => {
    const userAnime = [
      makeLegacyAnime("lib-manga", 303, { mediaType: "manga", volumesProgress: 2 }),
    ];
    const episodes = [makeLegacyEpisode("ep-manga", 303, 1)];

    const plan = planLegacyBackfill(userAnime, episodes);
    expect(plan.userMedia[0]?.mediaKind).toBe("manga");
    expect(plan.episodes).toHaveLength(0);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime_episodes",
        legacyId: "ep-manga",
        reason: "manga-episode-history",
      }),
    );
  });

  it("rejects cross-user episode history", () => {
    const userAnime = [makeLegacyAnime("lib-user1", 404, { userId: "user-1" })];
    // Episode row claiming to belong to user-2 for an entry owned by user-1
    const episodes = [
      makeLegacyEpisode("ep-cross", 404, 1, { userId: "user-2" }),
    ];
    const options: BackfillOptions = {
      catalogCache: new Map([[404, { format: "TV" }]]),
    };

    const plan = planLegacyBackfill(userAnime, episodes, options);
    expect(plan.episodes).toHaveLength(0);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime_episodes",
        legacyId: "ep-cross",
        reason: "orphan-episode",
      }),
    );
  });
});

describe("2. AniList movie classification during backfill", () => {
  it("classifies confirmed AniList MOVIE as canonical movie", () => {
    const userAnime = [makeLegacyAnime("lib-1", 501, { status: "completed", progress: 1 })];
    const options: BackfillOptions = {
      catalogCache: new Map([[501, { format: "MOVIE" }]]),
    };

    const plan = planLegacyBackfill(userAnime, [], options);
    expect(plan.issues).toHaveLength(0);
    expect(plan.media[0]?.kind).toBe("movie");
    expect(plan.userMedia[0]?.mediaKind).toBe("movie");
    expect(plan.userMedia[0]?.progress).toEqual({
      kind: "movie",
      watched: true,
    });
  });

  it("classifies confirmed AniList TV / series as canonical anime", () => {
    const userAnime = [makeLegacyAnime("lib-2", 502, { progress: 8 })];
    const options: BackfillOptions = {
      catalogCache: new Map([[502, { format: "TV" }]]),
    };

    const plan = planLegacyBackfill(userAnime, [], options);
    expect(plan.issues).toHaveLength(0);
    expect(plan.media[0]?.kind).toBe("anime");
    expect(plan.userMedia[0]?.mediaKind).toBe("anime");
    expect(plan.userMedia[0]?.progress).toEqual({
      kind: "anime",
      episodesWatched: 8,
    });
  });

  it("keeps manga records as canonical manga regardless of anime cache", () => {
    const userAnime = [
      makeLegacyAnime("lib-m1", 503, { mediaType: "manga", progress: 25, volumesProgress: 3 }),
    ];
    const options: BackfillOptions = {
      catalogCache: new Map([[503, { format: "MANGA" }]]),
    };

    const plan = planLegacyBackfill(userAnime, [], options);
    expect(plan.issues).toHaveLength(0);
    expect(plan.media[0]?.kind).toBe("manga");
    expect(plan.userMedia[0]?.mediaKind).toBe("manga");
    expect(plan.userMedia[0]?.progress).toEqual({
      kind: "manga",
      chaptersRead: 25,
      volumesRead: 3,
    });
  });

  it("quarantines records with missing cache metadata without guessing kind", () => {
    const userAnime = [makeLegacyAnime("lib-missing", 504)];
    // No catalogCache provided
    const plan = planLegacyBackfill(userAnime, []);
    expect(plan.media).toHaveLength(0);
    expect(plan.userMedia).toHaveLength(0);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime",
        legacyId: "lib-missing",
        reason: "missing-catalog-cache",
      }),
    );
  });

  it("quarantines records with malformed cache payload", () => {
    const userAnime = [makeLegacyAnime("lib-malformed", 505)];
    const options: BackfillOptions = {
      catalogCache: new Map([[505, { format: null }]]),
    };

    const plan = planLegacyBackfill(userAnime, [], options);
    expect(plan.media).toHaveLength(0);
    expect(plan.userMedia).toHaveLength(0);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime",
        legacyId: "lib-malformed",
        reason: "malformed-catalog-cache",
      }),
    );
  });

  it("quarantines records with conflicting cache metadata", () => {
    const userAnime = [makeLegacyAnime("lib-conflict", 506)];
    const options: BackfillOptions = {
      catalogCache: new Map([[506, [{ format: "MOVIE" }, { format: "TV" }]]]),
    };

    const plan = planLegacyBackfill(userAnime, [], options);
    expect(plan.media).toHaveLength(0);
    expect(plan.userMedia).toHaveLength(0);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime",
        legacyId: "lib-conflict",
        reason: "conflicting-catalog-cache",
      }),
    );
  });

  it("quarantines records when cache payload is not an object or null", () => {
    const userAnime = [makeLegacyAnime("lib-null-payload", 508)];
    const options: BackfillOptions = {
      catalogCache: new Map([[508, null as unknown as CatalogCacheEntry]]),
    };

    const plan = planLegacyBackfill(userAnime, [], options);
    expect(plan.media).toHaveLength(0);
    expect(plan.userMedia).toHaveLength(0);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime",
        legacyId: "lib-null-payload",
        reason: "malformed-catalog-cache",
      }),
    );
  });

  it("quarantines records when format is missing, empty, or unrecognised", () => {
    const userAnime1 = [makeLegacyAnime("lib-empty-fmt", 509)];
    const userAnime2 = [makeLegacyAnime("lib-invalid-fmt", 510)];

    const plan1 = planLegacyBackfill(userAnime1, [], {
      catalogCache: new Map([[509, { format: "   " }]]),
    });
    expect(plan1.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime",
        legacyId: "lib-empty-fmt",
        reason: "malformed-catalog-cache",
      }),
    );

    const plan2 = planLegacyBackfill(userAnime2, [], {
      catalogCache: new Map([[510, { format: "UNRECOGNIZED_FORMAT" }]]),
    });
    expect(plan2.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime",
        legacyId: "lib-invalid-fmt",
        reason: "malformed-catalog-cache",
      }),
    );
  });

  it("quarantines records when cache contains mixed valid and malformed entries", () => {
    const userAnime = [makeLegacyAnime("lib-mixed", 511)];
    const options: BackfillOptions = {
      catalogCache: new Map([[511, [{ format: "TV" }, { format: null }]]]),
    };

    const plan = planLegacyBackfill(userAnime, [], options);
    expect(plan.media).toHaveLength(0);
    expect(plan.userMedia).toHaveLength(0);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime",
        legacyId: "lib-mixed",
        reason: "malformed-catalog-cache",
      }),
    );
  });

  it("accepts repeated cache entries with identical valid format", () => {
    const userAnime = [makeLegacyAnime("lib-repeated", 512, { progress: 4 })];
    const options: BackfillOptions = {
      catalogCache: new Map([[512, [{ format: "TV" }, { format: "TV" }]]]),
    };

    const plan = planLegacyBackfill(userAnime, [], options);
    expect(plan.issues).toHaveLength(0);
    expect(plan.media[0]?.kind).toBe("anime");
    expect(plan.userMedia[0]?.mediaKind).toBe("anime");
  });

  it("migrates cleanly on rerun once metadata becomes available", () => {
    const userAnime = [makeLegacyAnime("lib-rerun", 507)];
    // Run 1: Missing cache
    const run1 = planLegacyBackfill(userAnime, []);
    expect(run1.issues).toHaveLength(1);
    expect(run1.userMedia).toHaveLength(0);

    // Run 2: Metadata has arrived (MOVIE)
    const run2 = planLegacyBackfill(userAnime, [], {
      catalogCache: new Map([[507, { format: "MOVIE" }]]),
    });
    expect(run2.issues).toHaveLength(0);
    expect(run2.userMedia).toHaveLength(1);
    expect(run2.userMedia[0]?.mediaKind).toBe("movie");
  });
});

describe("3. Strict conflict handling", () => {
  it("treats identical rerun as successful idempotent rerun", () => {
    const userAnime = [makeLegacyAnime("lib-1", 601, { progress: 3 })];
    const derivedMediaId = deterministicAniListMediaId(601);

    const options: BackfillOptions = {
      catalogCache: new Map([[601, { format: "TV" }]]),
      existingMedia: new Map([[derivedMediaId, { id: derivedMediaId, kind: "anime" }]]),
      existingUserMedia: new Map([
        [
          "lib-1",
          {
            id: "lib-1",
            userId: "user-1",
            mediaId: derivedMediaId,
            mediaKind: "anime",
            status: "watching",
            progress: { kind: "anime", episodesWatched: 3 },
            score: 8,
            notes: "A note",
          },
        ],
      ]),
    };

    const plan = planLegacyBackfill(userAnime, [], options);
    expect(plan.issues).toHaveLength(0);
    // Already existing identical row is not re-inserted
    expect(plan.userMedia).toHaveLength(0);
  });

  it("records conflict when existing canonical UUID has conflicting kind", () => {
    const userAnime = [makeLegacyAnime("lib-1", 602)];
    const derivedMediaId = deterministicAniListMediaId(602);

    const options: BackfillOptions = {
      catalogCache: new Map([[602, { format: "TV" }]]), // indicates anime
      existingMedia: new Map([[derivedMediaId, { id: derivedMediaId, kind: "manga" }]]), // conflicts
    };

    const plan = planLegacyBackfill(userAnime, [], options);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime",
        legacyId: "lib-1",
        reason: "conflicting-canonical-media-kind",
      }),
    );
  });

  it("records conflict when existing AniList mapping points to another media UUID", () => {
    const userAnime = [makeLegacyAnime("lib-1", 603)];
    const foreignMediaId = mediaId(OTHER_MEDIA_UUID);

    const options: BackfillOptions = {
      catalogCache: new Map([[603, { format: "TV" }]]),
      existingMappings: new Map([
        ["anilist:603", { mediaId: foreignMediaId, kind: "anime" }],
      ]),
    };

    const plan = planLegacyBackfill(userAnime, [], options);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime",
        legacyId: "lib-1",
        reason: "conflicting-provider-mapping",
      }),
    );
  });

  it("records conflict when existing library row has conflicting progress", () => {
    const userAnime = [makeLegacyAnime("lib-1", 604, { progress: 10 })];
    const derivedMediaId = deterministicAniListMediaId(604);

    const options: BackfillOptions = {
      catalogCache: new Map([[604, { format: "TV" }]]),
      existingUserMedia: new Map([
        [
          "lib-1",
          {
            id: "lib-1",
            userId: "user-1",
            mediaId: derivedMediaId,
            mediaKind: "anime",
            status: "watching",
            progress: { kind: "anime", episodesWatched: 5 }, // conflicts with progress: 10
            score: 8,
          },
        ],
      ]),
    };

    const plan = planLegacyBackfill(userAnime, [], options);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime",
        legacyId: "lib-1",
        reason: "conflicting-library-progress",
      }),
    );
    expect(plan.userMedia).toHaveLength(0);
  });

  it("records conflict when existing library row has conflicting user ownership", () => {
    const userAnime = [makeLegacyAnime("lib-1", 605, { userId: "user-1" })];
    const derivedMediaId = deterministicAniListMediaId(605);

    const options: BackfillOptions = {
      catalogCache: new Map([[605, { format: "TV" }]]),
      existingUserMedia: new Map([
        [
          "lib-1",
          {
            id: "lib-1",
            userId: "user-2", // conflicts with user-1
            mediaId: derivedMediaId,
            mediaKind: "anime",
            status: "watching",
            progress: { kind: "anime", episodesWatched: 5 },
            score: 8,
          },
        ],
      ]),
    };

    const plan = planLegacyBackfill(userAnime, [], options);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime",
        legacyId: "lib-1",
        reason: "conflicting-library-user-ownership",
      }),
    );
  });

  it("records conflict when existing episode row has conflicting parent user_media_id", () => {
    const userAnime = [makeLegacyAnime("lib-1", 606)];
    const episodes = [makeLegacyEpisode("ep-1", 606, 1)];

    const options: BackfillOptions = {
      catalogCache: new Map([[606, { format: "TV" }]]),
      existingEpisodes: new Map([
        [
          "ep-1",
          {
            id: "ep-1",
            userId: "user-1",
            userMediaId: "different-parent-id", // conflicts
            seasonNumber: 0,
            episodeNumber: 1,
            watchedAt: "2026-01-01T12:00:00.000Z",
          },
        ],
      ]),
    };

    const plan = planLegacyBackfill(userAnime, episodes, options);
    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime_episodes",
        legacyId: "ep-1",
        reason: "conflicting-episode-parent",
      }),
    );
  });

  it("records conflict when existing library row has conflicting status, score, or notes", () => {
    const userAnime = [makeLegacyAnime("lib-1", 607, { status: "watching", score: 8, notes: "Original" })];
    const derivedMediaId = deterministicAniListMediaId(607);

    // Conflict on status
    const planStatus = planLegacyBackfill(userAnime, [], {
      catalogCache: new Map([[607, { format: "TV" }]]),
      existingUserMedia: new Map([
        [
          "lib-1",
          {
            id: "lib-1",
            userId: "user-1",
            mediaId: derivedMediaId,
            mediaKind: "anime",
            status: "completed", // conflicts
            progress: { kind: "anime", episodesWatched: 5 },
            score: 8,
            notes: "Original",
          },
        ],
      ]),
    });
    expect(planStatus.issues).toContainEqual(
      expect.objectContaining({ reason: "conflicting-library-status" }),
    );

    // Conflict on score
    const planScore = planLegacyBackfill(userAnime, [], {
      catalogCache: new Map([[607, { format: "TV" }]]),
      existingUserMedia: new Map([
        [
          "lib-1",
          {
            id: "lib-1",
            userId: "user-1",
            mediaId: derivedMediaId,
            mediaKind: "anime",
            status: "watching",
            progress: { kind: "anime", episodesWatched: 5 },
            score: 5, // conflicts
            notes: "Original",
          },
        ],
      ]),
    });
    expect(planScore.issues).toContainEqual(
      expect.objectContaining({ reason: "conflicting-library-score" }),
    );

    // Conflict on notes
    const planNotes = planLegacyBackfill(userAnime, [], {
      catalogCache: new Map([[607, { format: "TV" }]]),
      existingUserMedia: new Map([
        [
          "lib-1",
          {
            id: "lib-1",
            userId: "user-1",
            mediaId: derivedMediaId,
            mediaKind: "anime",
            status: "watching",
            progress: { kind: "anime", episodesWatched: 5 },
            score: 8,
            notes: "Different note", // conflicts
          },
        ],
      ]),
    });
    expect(planNotes.issues).toContainEqual(
      expect.objectContaining({ reason: "conflicting-library-notes" }),
    );
  });

  it("records conflict when existing library row has conflicting favorite, rewatch count, or dates", () => {
    const userAnime = [
      makeLegacyAnime("lib-1", 608, {
        startedAt: "2026-01-01",
        completedAt: null,
      }),
    ];
    const derivedMediaId = deterministicAniListMediaId(608);

    // Conflict on favorite
    const planFavorite = planLegacyBackfill(userAnime, [], {
      catalogCache: new Map([[608, { format: "TV" }]]),
      existingUserMedia: new Map([
        [
          "lib-1",
          {
            id: "lib-1",
            userId: "user-1",
            mediaId: derivedMediaId,
            mediaKind: "anime",
            status: "watching",
            progress: { kind: "anime", episodesWatched: 5 },
            score: 8,
            favorite: true, // conflicts with backfill default false
          },
        ],
      ]),
    });
    expect(planFavorite.issues).toContainEqual(
      expect.objectContaining({ reason: "conflicting-library-favorite" }),
    );

    // Conflict on rewatch count
    const planRewatch = planLegacyBackfill(userAnime, [], {
      catalogCache: new Map([[608, { format: "TV" }]]),
      existingUserMedia: new Map([
        [
          "lib-1",
          {
            id: "lib-1",
            userId: "user-1",
            mediaId: derivedMediaId,
            mediaKind: "anime",
            status: "watching",
            progress: { kind: "anime", episodesWatched: 5 },
            score: 8,
            rewatchCount: 2, // conflicts with backfill default 0
          },
        ],
      ]),
    });
    expect(planRewatch.issues).toContainEqual(
      expect.objectContaining({ reason: "conflicting-library-rewatch-count" }),
    );

    // Conflict on dates
    const planDates = planLegacyBackfill(userAnime, [], {
      catalogCache: new Map([[608, { format: "TV" }]]),
      existingUserMedia: new Map([
        [
          "lib-1",
          {
            id: "lib-1",
            userId: "user-1",
            mediaId: derivedMediaId,
            mediaKind: "anime",
            status: "watching",
            progress: { kind: "anime", episodesWatched: 5 },
            score: 8,
            startedAt: "2025-05-05", // conflicts with 2026-01-01
          },
        ],
      ]),
    });
    expect(planDates.issues).toContainEqual(
      expect.objectContaining({ reason: "conflicting-library-dates" }),
    );
  });

  it("handles conflict against alternate unique key (userId, mediaId) with different primary ID", () => {
    const userAnime = [makeLegacyAnime("lib-new-id", 609, { progress: 5 })];
    const derivedMediaId = deterministicAniListMediaId(609);

    // 1. Alternate key conflict with conflicting progress
    const planConflicting = planLegacyBackfill(userAnime, [], {
      catalogCache: new Map([[609, { format: "TV" }]]),
      existingUserMedia: new Map([
        [
          "user-1:" + derivedMediaId,
          {
            id: "lib-different-uuid",
            userId: "user-1",
            mediaId: derivedMediaId,
            mediaKind: "anime",
            status: "watching",
            progress: { kind: "anime", episodesWatched: 20 }, // conflicts
            score: 8,
          },
        ],
      ]),
    });
    expect(planConflicting.issues).toContainEqual(
      expect.objectContaining({
        reason: "conflicting-alternate-key-library",
        details: expect.objectContaining({
          libraryId: "lib-new-id",
          existingId: "lib-different-uuid",
        }),
      }),
    );
    expect(planConflicting.userMedia).toHaveLength(0);

    // 2. Alternate key conflict where all fields match identically but ID is different
    const planIdenticalFields = planLegacyBackfill(userAnime, [], {
      catalogCache: new Map([[609, { format: "TV" }]]),
      existingUserMedia: new Map([
        [
          "user-1:" + derivedMediaId,
          {
            id: "lib-different-uuid",
            userId: "user-1",
            mediaId: derivedMediaId,
            mediaKind: "anime",
            status: "watching",
            progress: { kind: "anime", episodesWatched: 5 }, // identical
            score: 8,
            notes: "A note",
            favorite: false,
            rewatchCount: 0,
            startedAt: "2026-01-01",
            completedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      ]),
    });
    // Identical alternate-key match with different primary UUID is an idempotent match, not a conflict
    expect(planIdenticalFields.issues).toHaveLength(0);
    expect(planIdenticalFields.userMedia).toHaveLength(0);
  });

  it("handles episode conflicts against primary ID and alternate unique key", () => {
    const userAnime = [makeLegacyAnime("lib-1", 610)];
    const episodes = [makeLegacyEpisode("ep-1", 610, 1)];

    // 1. Existing episode with different number
    const planNumber = planLegacyBackfill(userAnime, episodes, {
      catalogCache: new Map([[610, { format: "TV" }]]),
      existingEpisodes: new Map([
        [
          "ep-1",
          {
            id: "ep-1",
            userId: "user-1",
            userMediaId: "lib-1",
            seasonNumber: 0,
            episodeNumber: 99, // conflicts
            watchedAt: "2026-01-01T12:00:00.000Z",
          },
        ],
      ]),
    });
    expect(planNumber.issues).toContainEqual(
      expect.objectContaining({ reason: "conflicting-episode-number" }),
    );

    // 2. Existing episode with different watchedAt
    const planWatched = planLegacyBackfill(userAnime, episodes, {
      catalogCache: new Map([[610, { format: "TV" }]]),
      existingEpisodes: new Map([
        [
          "ep-1",
          {
            id: "ep-1",
            userId: "user-1",
            userMediaId: "lib-1",
            seasonNumber: 0,
            episodeNumber: 1,
            watchedAt: "2026-05-01T00:00:00.000Z", // conflicts
          },
        ],
      ]),
    });
    expect(planWatched.issues).toContainEqual(
      expect.objectContaining({ reason: "conflicting-episode-watched-at" }),
    );

    // 3. Alternate key (userMediaId, season, episodeNumber) conflict with different primary ID (conflicting fields)
    const planAltConflicting = planLegacyBackfill(userAnime, episodes, {
      catalogCache: new Map([[610, { format: "TV" }]]),
      existingEpisodes: new Map([
        [
          "lib-1:0:1",
          {
            id: "ep-different-id",
            userId: "user-2", // conflicts
            userMediaId: "lib-1",
            seasonNumber: 0,
            episodeNumber: 1,
            watchedAt: "2026-01-01T12:00:00.000Z",
          },
        ],
      ]),
    });
    expect(planAltConflicting.issues).toContainEqual(
      expect.objectContaining({ reason: "conflicting-alternate-key-episode" }),
    );

    // 4. Alternate key conflict with identical fields but different ID
    const planAltIdentical = planLegacyBackfill(userAnime, episodes, {
      catalogCache: new Map([[610, { format: "TV" }]]),
      existingEpisodes: new Map([
        [
          "lib-1:0:1",
          {
            id: "ep-different-id",
            userId: "user-1",
            userMediaId: "lib-1",
            seasonNumber: 0,
            episodeNumber: 1,
            watchedAt: "2026-01-01T12:00:00.000Z",
            createdAt: "2026-01-01T12:00:00.000Z",
          },
        ],
      ]),
    });
    // Identical alternate-key episode match with different primary UUID is an idempotent match, not a conflict
    expect(planAltIdentical.issues).toHaveLength(0);
    expect(planAltIdentical.episodes).toHaveLength(0);
  });

  it("handles repeated execution after successful migration without duplicating or raising issues", () => {
    const userAnime = [makeLegacyAnime("lib-1", 611, { progress: 5 })];
    const episodes = [makeLegacyEpisode("ep-1", 611, 1)];
    const derivedMediaId = deterministicAniListMediaId(611);

    // Simulate complete prior successful migration in destination tables
    const options: BackfillOptions = {
      catalogCache: new Map([[611, { format: "TV" }]]),
      existingMedia: new Map([[derivedMediaId, { id: derivedMediaId, kind: "anime" }]]),
      existingUserMedia: new Map([
        [
          "lib-1",
          {
            id: "lib-1",
            userId: "user-1",
            mediaId: derivedMediaId,
            mediaKind: "anime",
            status: "watching",
            progress: { kind: "anime", episodesWatched: 5 },
            score: 8,
            notes: "A note",
            favorite: false,
            rewatchCount: 0,
            startedAt: "2026-01-01",
            completedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      ]),
      existingEpisodes: new Map([
        [
          "ep-1",
          {
            id: "ep-1",
            userId: "user-1",
            userMediaId: "lib-1",
            seasonNumber: 0,
            episodeNumber: 1,
            watchedAt: "2026-01-01T12:00:00.000Z",
            createdAt: "2026-01-01T12:00:00.000Z",
          },
        ],
      ]),
    };

    const rerun = planLegacyBackfill(userAnime, episodes, options);
    expect(rerun.issues).toHaveLength(0);
    expect(rerun.userMedia).toHaveLength(0);
    expect(rerun.episodes).toHaveLength(0);
  });

  it("handles repeated execution after quarantine without inserting rows", () => {
    const userAnime = [makeLegacyAnime("lib-quarantine", 612)];
    // No metadata available -> quarantined
    const run1 = planLegacyBackfill(userAnime, []);
    expect(run1.issues).toHaveLength(1);
    expect(run1.userMedia).toHaveLength(0);

    // Rerun without new metadata -> still quarantined, still 0 inserts
    const run2 = planLegacyBackfill(userAnime, []);
    expect(run2.issues).toHaveLength(1);
    expect(run2.userMedia).toHaveLength(0);
  });

  it("handles partial migration followed by a clean rerun", () => {
    const row1 = makeLegacyAnime("lib-1", 701, { progress: 3 });
    const row2 = makeLegacyAnime("lib-2", 702, { progress: 7 });
    const userAnime = [row1, row2];
    const mediaId1 = deterministicAniListMediaId(701);

    // Initial state: row1 already migrated, row2 not yet migrated
    const options: BackfillOptions = {
      catalogCache: new Map([
        [701, { format: "TV" }],
        [702, { format: "TV" }],
      ]),
      existingUserMedia: new Map([
        [
          "lib-1",
          {
            id: "lib-1",
            userId: "user-1",
            mediaId: mediaId1,
            mediaKind: "anime",
            status: "watching",
            progress: { kind: "anime", episodesWatched: 3 },
            score: 8,
            notes: "A note",
          },
        ],
      ]),
    };

    const plan = planLegacyBackfill(userAnime, [], options);
    expect(plan.issues).toHaveLength(0);
    // Only the unmigrated row2 is planned for insertion
    expect(plan.userMedia).toHaveLength(1);
    expect(plan.userMedia[0]?.id).toBe("lib-2");
  });
});

describe("4. Persistence validation boundary", () => {
  const VALID_ENTRY_UUID = "123e4567-e89b-42d3-a456-426614174001";
  const VALID_USER_UUID = "123e4567-e89b-42d3-a456-426614174002";

  const validEntry: MediaLibraryEntry = {
    id: VALID_ENTRY_UUID,
    userId: VALID_USER_UUID,
    mediaId: mediaId(TEST_MEDIA_UUID),
    mediaKind: "anime",
    status: "watching",
    progress: { kind: "anime", episodesWatched: 5 },
    score: 9,
    favorite: false,
    notes: "Great show",
    rewatchCount: 0,
    startedAt: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const validMedia: MediaSummary = {
    id: mediaId(TEST_MEDIA_UUID),
    kind: "anime",
    title: { primary: "Test Anime", romaji: "Test", english: "Test", native: null },
    synopsis: null,
    artwork: [],
    genres: ["Action"],
    releaseYear: 2024,
    releaseStatus: "FINISHED",
    format: "TV",
    communityRating: null,
    providerRefs: [{ provider: "anilist", externalId: "100" }],
    isAdult: false,
    episodes: 28,
    countryOfOrigin: "JP",
  };

  it("validates a conforming MediaLibraryEntry", () => {
    const validated = validateMediaLibraryEntry(validEntry);
    expect(validated).toEqual(validEntry);
    expect(() => assertMediaLibraryItem(validEntry, validMedia)).not.toThrow();
  });

  it("preserves nullable catalog metadata when valid library state exists", () => {
    expect(() => assertMediaLibraryItem(validEntry, null)).not.toThrow();
    expect(() => assertMediaLibraryItem(validEntry, undefined)).not.toThrow();
  });

  it("rejects non-object inputs", () => {
    expect(() => validateMediaLibraryEntry(null)).toThrow(MediaLibraryInvariantError);
    expect(() => validateMediaLibraryEntry("string")).toThrow(MediaLibraryInvariantError);
    expect(() => validateMediaLibraryEntry(123)).toThrow(MediaLibraryInvariantError);
    expect(() => validateMediaLibraryEntry([])).toThrow(MediaLibraryInvariantError);
  });

  it("rejects malformed IDs and empty strings", () => {
    expect(() => validateMediaLibraryEntry({ ...validEntry, id: "" })).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => validateMediaLibraryEntry({ ...validEntry, userId: "   " })).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => validateMediaLibraryEntry({ ...validEntry, mediaId: "not-a-uuid" })).toThrow(
      MediaLibraryInvariantError,
    );
  });

  it("rejects invalid media kinds", () => {
    expect(() => validateMediaLibraryEntry({ ...validEntry, mediaKind: "novel" })).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => validateMediaLibraryEntry({ ...validEntry, mediaKind: "" })).toThrow(
      MediaLibraryInvariantError,
    );
  });

  it("rejects progress incompatible with media kind", () => {
    // anime with movie progress
    expect(() =>
      validateMediaLibraryEntry({
        ...validEntry,
        mediaKind: "anime",
        progress: { kind: "movie", watched: true },
      }),
    ).toThrow(MediaLibraryInvariantError);

    // movie with anime progress
    expect(() =>
      validateMediaLibraryEntry({
        ...validEntry,
        mediaKind: "movie",
        progress: { kind: "anime", episodesWatched: 1 },
      }),
    ).toThrow(MediaLibraryInvariantError);
  });

  it("rejects negative progress and non-integer values", () => {
    expect(() =>
      validateMediaLibraryEntry({
        ...validEntry,
        progress: { kind: "anime", episodesWatched: -1 },
      }),
    ).toThrow(MediaLibraryInvariantError);

    expect(() =>
      validateMediaLibraryEntry({
        ...validEntry,
        progress: { kind: "anime", episodesWatched: 4.5 },
      }),
    ).toThrow(MediaLibraryInvariantError);

    expect(() =>
      validateMediaLibraryEntry({
        ...validEntry,
        progress: { kind: "anime", episodesWatched: NaN },
      }),
    ).toThrow(MediaLibraryInvariantError);
  });

  it("rejects invalid score ranges and non-finite values", () => {
    expect(() => validateMediaLibraryEntry({ ...validEntry, score: 0 })).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => validateMediaLibraryEntry({ ...validEntry, score: 11 })).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => validateMediaLibraryEntry({ ...validEntry, score: 8.5 })).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => validateMediaLibraryEntry({ ...validEntry, score: NaN })).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => validateMediaLibraryEntry({ ...validEntry, score: Infinity })).toThrow(
      MediaLibraryInvariantError,
    );
  });

  it("rejects invalid UUIDs for entry id and userId", () => {
    expect(() => validateMediaLibraryEntry({ ...validEntry, id: "not-a-uuid" })).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => validateMediaLibraryEntry({ ...validEntry, userId: "not-a-uuid" })).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => validateMediaLibraryEntry({ ...validEntry, id: "" })).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => validateMediaLibraryEntry({ ...validEntry, userId: "" })).toThrow(
      MediaLibraryInvariantError,
    );
  });

  it("rejects invalid dates and timestamps", () => {
    expect(() => validateMediaLibraryEntry({ ...validEntry, createdAt: "invalid-date" })).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => validateMediaLibraryEntry({ ...validEntry, updatedAt: "invalid-date" })).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => validateMediaLibraryEntry({ ...validEntry, startedAt: "invalid-date" })).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => validateMediaLibraryEntry({ ...validEntry, completedAt: "invalid-date" })).toThrow(
      MediaLibraryInvariantError,
    );
  });

  it("rejects invalid episodeProgress elements and shapes", () => {
    // Non-object item
    expect(() =>
      validateMediaLibraryEntry({
        ...validEntry,
        episodeProgress: ["invalid-item" as unknown as MediaEpisodeProgress],
      }),
    ).toThrow(MediaLibraryInvariantError);

    // Negative season number
    expect(() =>
      validateMediaLibraryEntry({
        ...validEntry,
        episodeProgress: [{ seasonNumber: -1, episodeNumber: 1, watchedAt: null }],
      }),
    ).toThrow(MediaLibraryInvariantError);

    // Fractional season number
    expect(() =>
      validateMediaLibraryEntry({
        ...validEntry,
        episodeProgress: [{ seasonNumber: 1.5, episodeNumber: 1, watchedAt: null }],
      }),
    ).toThrow(MediaLibraryInvariantError);

    // Zero episode number (must be > 0)
    expect(() =>
      validateMediaLibraryEntry({
        ...validEntry,
        episodeProgress: [{ seasonNumber: 0, episodeNumber: 0, watchedAt: null }],
      }),
    ).toThrow(MediaLibraryInvariantError);

    // Negative episode number
    expect(() =>
      validateMediaLibraryEntry({
        ...validEntry,
        episodeProgress: [{ seasonNumber: 0, episodeNumber: -2, watchedAt: null }],
      }),
    ).toThrow(MediaLibraryInvariantError);

    // Invalid watchedAt date string
    expect(() =>
      validateMediaLibraryEntry({
        ...validEntry,
        episodeProgress: [{ seasonNumber: 0, episodeNumber: 1, watchedAt: "invalid-date" }],
      }),
    ).toThrow(MediaLibraryInvariantError);

    // Movie carrying episodeProgress
    expect(() =>
      validateMediaLibraryEntry({
        ...validEntry,
        mediaKind: "movie",
        progress: { kind: "movie", watched: true },
        episodeProgress: [{ seasonNumber: 0, episodeNumber: 1, watchedAt: null }],
      }),
    ).toThrow(MediaLibraryInvariantError);
  });

  it("rejects non-object hydrated media", () => {
    expect(() => assertMediaLibraryItem(validEntry, "not-an-object")).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => assertMediaLibraryItem(validEntry, 123)).toThrow(
      MediaLibraryInvariantError,
    );
  });

  it("rejects catalog and library kind mismatches", () => {
    const movieMedia: MediaSummary = {
      id: validMedia.id,
      kind: "movie",
      title: validMedia.title,
      synopsis: validMedia.synopsis,
      artwork: validMedia.artwork,
      genres: validMedia.genres,
      releaseYear: validMedia.releaseYear,
      releaseStatus: validMedia.releaseStatus,
      format: "MOVIE",
      communityRating: validMedia.communityRating,
      providerRefs: validMedia.providerRefs,
      isAdult: validMedia.isAdult,
      runtimeMinutes: 120,
    };
    // validEntry is "anime", movieMedia is "movie"
    expect(() => assertMediaLibraryItem(validEntry, movieMedia)).toThrow(
      MediaLibraryInvariantError,
    );
  });

  it("rejects catalog and library ID mismatches", () => {
    const mismatchMedia: MediaSummary = {
      ...validMedia,
      id: mediaId(OTHER_MEDIA_UUID),
    };
    expect(() => assertMediaLibraryItem(validEntry, mismatchMedia)).toThrow(
      MediaLibraryInvariantError,
    );
  });
});

describe("Regression Tests: Alternate-Key Idempotency, Validation Reporting & Schema Consistency", () => {
  // 1. User-media identical alternate-key match with different UUID
  it("treats user-media with different primary UUID but identical alternate key and fields as idempotent match", () => {
    const userAnime = [makeLegacyAnime("lib-legacy-uuid", 700, { progress: 3 })];
    const derivedMediaId = deterministicAniListMediaId(700);

    const plan = planLegacyBackfill(userAnime, [], {
      catalogCache: new Map([[700, { format: "TV" }]]),
      existingUserMedia: new Map([
        [
          "user-1:" + derivedMediaId,
          {
            id: "lib-destination-canonical-uuid",
            userId: "user-1",
            mediaId: derivedMediaId,
            mediaKind: "anime",
            status: "watching",
            progress: { kind: "anime", episodesWatched: 3 },
            score: 8,
            notes: "A note",
            favorite: false,
            rewatchCount: 0,
            startedAt: "2026-01-01",
            completedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      ]),
    });

    expect(plan.issues).toHaveLength(0);
    expect(plan.userMedia).toHaveLength(0);
  });

  // 2. User-media conflicting alternate-key match with different UUID
  it("quarantines user-media with different primary UUID and conflicting alternate key fields", () => {
    const userAnime = [makeLegacyAnime("lib-legacy-uuid", 701, { progress: 3, score: 7 })];
    const derivedMediaId = deterministicAniListMediaId(701);

    const plan = planLegacyBackfill(userAnime, [], {
      catalogCache: new Map([[701, { format: "TV" }]]),
      existingUserMedia: new Map([
        [
          "user-1:" + derivedMediaId,
          {
            id: "lib-destination-canonical-uuid",
            userId: "user-1",
            mediaId: derivedMediaId,
            mediaKind: "anime",
            status: "watching",
            progress: { kind: "anime", episodesWatched: 3 },
            score: 10, // conflicts
          },
        ],
      ]),
    });

    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime",
        legacyId: "lib-legacy-uuid",
        reason: "conflicting-alternate-key-library",
        details: expect.objectContaining({
          libraryId: "lib-legacy-uuid",
          existingId: "lib-destination-canonical-uuid",
        }),
      }),
    );
    expect(plan.userMedia).toHaveLength(0);
  });

  // 3. Episode identical alternate-key match with different UUID
  it("treats episode with different primary UUID but identical alternate key and fields as idempotent match", () => {
    const userAnime = [makeLegacyAnime("lib-1", 702)];
    const episodes = [makeLegacyEpisode("ep-legacy-uuid", 702, 1)];

    const plan = planLegacyBackfill(userAnime, episodes, {
      catalogCache: new Map([[702, { format: "TV" }]]),
      existingEpisodes: new Map([
        [
          "lib-1:0:1",
          {
            id: "ep-destination-canonical-uuid",
            userId: "user-1",
            userMediaId: "lib-1",
            seasonNumber: 0,
            episodeNumber: 1,
            watchedAt: "2026-01-01T12:00:00.000Z",
            createdAt: "2026-01-01T12:00:00.000Z",
          },
        ],
      ]),
    });

    expect(plan.issues).toHaveLength(0);
    expect(plan.episodes).toHaveLength(0);
  });

  // 4. Episode conflicting alternate-key match with different UUID
  it("quarantines episode with different primary UUID and conflicting alternate key fields", () => {
    const userAnime = [makeLegacyAnime("lib-1", 703)];
    const episodes = [makeLegacyEpisode("ep-legacy-uuid", 703, 1)];

    const plan = planLegacyBackfill(userAnime, episodes, {
      catalogCache: new Map([[703, { format: "TV" }]]),
      existingEpisodes: new Map([
        [
          "lib-1:0:1",
          {
            id: "ep-destination-canonical-uuid",
            userId: "user-1",
            userMediaId: "lib-1",
            seasonNumber: 0,
            episodeNumber: 1,
            watchedAt: "2026-08-01T00:00:00.000Z", // conflicts with ep-1's watchedAt
          },
        ],
      ]),
    });

    expect(plan.issues).toContainEqual(
      expect.objectContaining({
        legacyTable: "user_anime_episodes",
        legacyId: "ep-legacy-uuid",
        reason: "conflicting-alternate-key-episode",
        details: expect.objectContaining({
          episodeId: "ep-legacy-uuid",
          existingId: "ep-destination-canonical-uuid",
        }),
      }),
    );
    expect(plan.episodes).toHaveLength(0);
  });

  // 5. Historical resolved issue excluded from unresolved count
  it("excludes historical resolved issues from unresolved validation count", () => {
    const issues: BackfillIssueRecord[] = [
      {
        id: "1",
        runId: "run-1",
        legacyTable: "user_anime",
        legacyId: "leg-1",
        reason: "missing-catalog-cache",
        createdAt: "2026-11-04T00:00:00.000Z",
        resolvedAt: "2026-11-05T00:00:00.000Z", // resolved
      },
      {
        id: "2",
        runId: "run-1",
        legacyTable: "user_anime",
        legacyId: "leg-2",
        reason: "malformed-catalog-cache",
        createdAt: "2026-11-04T00:00:00.000Z",
        resolvedAt: "2026-11-05T00:00:00.000Z", // resolved
      },
    ];

    const summary = summarizeBackfillIssues(issues);
    expect(summary.totalHistorical).toBe(2);
    expect(summary.resolved).toBe(2);
    expect(summary.unresolved).toBe(0);
  });

  // 6. Unresolved issue included in unresolved count
  it("includes unresolved issues in unresolved validation count", () => {
    const issues: BackfillIssueRecord[] = [
      {
        id: "1",
        runId: "run-1",
        legacyTable: "user_anime",
        legacyId: "leg-1",
        reason: "missing-catalog-cache",
        createdAt: "2026-11-04T00:00:00.000Z",
        resolvedAt: null, // unresolved
      },
      {
        id: "2",
        runId: "run-1",
        legacyTable: "user_anime",
        legacyId: "leg-2",
        reason: "conflicting-alternate-key-library",
        createdAt: "2026-11-04T00:00:00.000Z",
        resolvedAt: null, // unresolved
      },
    ];

    const summary = summarizeBackfillIssues(issues);
    expect(summary.totalHistorical).toBe(2);
    expect(summary.resolved).toBe(0);
    expect(summary.unresolved).toBe(2);
  });

  // 7. Multiple-run validation reporting
  it("reports total historical, resolved, unresolved, and latest run stats correctly across multiple runs", () => {
    const issues: BackfillIssueRecord[] = [
      // Run 1: 2 issues (both now resolved)
      {
        id: "1",
        runId: "run-1",
        legacyTable: "user_anime",
        legacyId: "leg-1",
        reason: "missing-catalog-cache",
        createdAt: "2026-11-01T00:00:00.000Z",
        resolvedAt: "2026-11-02T00:00:00.000Z",
      },
      {
        id: "2",
        runId: "run-1",
        legacyTable: "user_anime",
        legacyId: "leg-2",
        reason: "malformed-catalog-cache",
        createdAt: "2026-11-01T00:00:00.000Z",
        resolvedAt: "2026-11-02T00:00:00.000Z",
      },
      // Run 2 (latest): 3 issues (1 resolved, 2 unresolved)
      {
        id: "3",
        runId: "run-2",
        legacyTable: "user_anime",
        legacyId: "leg-3",
        reason: "missing-catalog-cache",
        createdAt: "2026-11-05T00:00:00.000Z",
        resolvedAt: "2026-11-05T01:00:00.000Z",
      },
      {
        id: "4",
        runId: "run-2",
        legacyTable: "user_anime",
        legacyId: "leg-4",
        reason: "conflicting-alternate-key-library",
        createdAt: "2026-11-05T00:00:00.000Z",
        resolvedAt: null,
      },
      {
        id: "5",
        runId: "run-2",
        legacyTable: "user_anime_episodes",
        legacyId: "ep-5",
        reason: "conflicting-alternate-key-episode",
        createdAt: "2026-11-05T00:00:00.000Z",
        resolvedAt: null,
      },
    ];

    const runs: BackfillRunRecord[] = [
      {
        id: "run-1",
        startedAt: "2026-11-01T00:00:00.000Z",
        completedAt: "2026-11-01T00:05:00.000Z",
        outcome: "completed",
      },
      {
        id: "run-2",
        startedAt: "2026-11-05T00:00:00.000Z",
        completedAt: "2026-11-05T00:05:00.000Z",
        outcome: "completed",
      },
    ];

    const summary = summarizeBackfillIssues(issues, runs);
    expect(summary.latestRunId).toBe("run-2");
    expect(summary.totalHistorical).toBe(5);
    expect(summary.resolved).toBe(3);
    expect(summary.unresolved).toBe(2);
    expect(summary.latestRunTotal).toBe(3);
    expect(summary.latestRunUnresolved).toBe(2);
  });

  it("accurately reports latest run with zero issues when using media_backfill_runs ledger", () => {
    const runs: BackfillRunRecord[] = [
      {
        id: "run-1",
        startedAt: "2026-11-01T00:00:00.000Z",
        completedAt: "2026-11-01T00:01:00.000Z",
        outcome: "completed",
      },
      {
        id: "run-2-clean",
        startedAt: "2026-11-05T00:00:00.000Z",
        completedAt: "2026-11-05T00:01:00.000Z",
        outcome: "completed",
      },
    ];
    // Previous run 1 had an issue, but run 2 (latest) has zero issues
    const issues: BackfillIssueRecord[] = [
      {
        id: "1",
        runId: "run-1",
        legacyTable: "user_anime",
        legacyId: "leg-1",
        reason: "missing-catalog-cache",
        createdAt: "2026-11-01T00:00:00.000Z",
        resolvedAt: "2026-11-05T00:00:00.000Z",
      },
    ];

    const summary = summarizeBackfillIssues(issues, runs);
    expect(summary.latestRunId).toBe("run-2-clean");
    expect(summary.latestRunOutcome).toBe("completed");
    expect(summary.totalHistorical).toBe(1);
    expect(summary.resolved).toBe(1);
    expect(summary.unresolved).toBe(0);
    expect(summary.latestRunTotal).toBe(0); // 0 issues in latest clean run
    expect(summary.latestRunUnresolved).toBe(0);
  });

  it("handles successful nonzero-issue, zero-issue, running, and failed run outcomes in ledger summaries", () => {
    // 1. Successful run with quarantined issues
    const runsWithIssues: BackfillRunRecord[] = [
      {
        id: "run-success-issues",
        startedAt: "2026-11-05T01:00:00.000Z",
        completedAt: "2026-11-05T01:02:00.000Z",
        outcome: "completed",
      },
    ];
    const issuesList: BackfillIssueRecord[] = [
      {
        id: "issue-1",
        runId: "run-success-issues",
        legacyTable: "user_anime",
        legacyId: "1",
        reason: "missing-catalog-cache",
      },
    ];
    const summaryIssues = summarizeBackfillIssues(issuesList, runsWithIssues);
    expect(summaryIssues.latestRunId).toBe("run-success-issues");
    expect(summaryIssues.latestRunOutcome).toBe("completed");
    expect(summaryIssues.latestRunTotal).toBe(1);
    expect(summaryIssues.latestRunUnresolved).toBe(1);

    // 2. Failed run recorded by external orchestration ledger
    const runsWithFailure: BackfillRunRecord[] = [
      {
        id: "run-failed",
        startedAt: "2026-11-05T02:00:00.000Z",
        completedAt: "2026-11-05T02:00:05.000Z",
        outcome: "failed",
        details: { error: "Database lock timeout" },
      },
    ];
    const summaryFailed = summarizeBackfillIssues([], runsWithFailure);
    expect(summaryFailed.latestRunId).toBe("run-failed");
    expect(summaryFailed.latestRunOutcome).toBe("failed");
    expect(summaryFailed.latestRunTotal).toBe(0);

    // 3. Pre-registered run currently in progress
    const runsRunning: BackfillRunRecord[] = [
      {
        id: "run-active",
        startedAt: "2026-11-05T03:00:00.000Z",
        completedAt: null,
        outcome: "running",
      },
    ];
    const summaryRunning = summarizeBackfillIssues([], runsRunning);
    expect(summaryRunning.latestRunId).toBe("run-active");
    expect(summaryRunning.latestRunOutcome).toBe("running");
  });

  it("validates run ID reuse correctly, allowing fresh and pre-registered runs while rejecting completed or failed runs", () => {
    const existingRuns: BackfillRunRecord[] = [
      {
        id: "run-completed-1",
        startedAt: "2026-11-05T00:00:00.000Z",
        completedAt: "2026-11-05T00:01:00.000Z",
        outcome: "completed",
      },
      {
        id: "run-failed-1",
        startedAt: "2026-11-05T01:00:00.000Z",
        completedAt: "2026-11-05T01:00:10.000Z",
        outcome: "failed",
      },
      {
        id: "run-running-1",
        startedAt: "2026-11-05T02:00:00.000Z",
        completedAt: null,
        outcome: "running",
      },
    ];

    // Fresh run ID: allowed
    const freshCheck = validateBackfillRunReuse("run-fresh-new", existingRuns);
    expect(freshCheck.allowProceed).toBe(true);
    expect(freshCheck.error).toBeUndefined();

    // Pre-registered 'running' run ID: allowed (orchestrator handoff)
    const runningCheck = validateBackfillRunReuse("run-running-1", existingRuns);
    expect(runningCheck.allowProceed).toBe(true);
    expect(runningCheck.error).toBeUndefined();

    // Completed run ID: rejected
    const completedCheck = validateBackfillRunReuse("run-completed-1", existingRuns);
    expect(completedCheck.allowProceed).toBe(false);
    expect(completedCheck.error).toContain("already completed and cannot be reused");

    // Failed run ID: rejected
    const failedCheck = validateBackfillRunReuse("run-failed-1", existingRuns);
    expect(failedCheck.allowProceed).toBe(false);
    expect(failedCheck.error).toContain("already failed and cannot be reused");
  });

  it("computes deterministic RFC 4122 UUIDv3 test vectors matching standard namespace and algorithm", () => {
    expect(ANILIST_UUID_NAMESPACE).toBe("6ba7b811-9dad-11d1-80b4-00c04fd430c8");

    // Test vector 1: AniList ID 1
    const uuid1 = deterministicAniListMediaId(1);
    expect(uuid1).toBe("bc1934ba-4c73-38ba-b848-61928124cb64");
    expect(uuid1[14]).toBe("3"); // Version 3
    expect(["8", "9", "a", "b"]).toContain(uuid1[19]); // RFC 4122 variant bits 10xx

    // Test vector 2: AniList ID 21 (One Piece)
    const uuid21 = deterministicAniListMediaId(21);
    expect(uuid21).toBe("d2fbc542-0768-3a30-ab27-040f1dcdeb16");
    expect(uuid21[14]).toBe("3");
    expect(["8", "9", "a", "b"]).toContain(uuid21[19]);

    // Test vector 3: AniList ID 16498 (Attack on Titan)
    const uuid16498 = deterministicAniListMediaId(16498);
    expect(uuid16498).toBe("6a94b024-3842-3a12-a716-0e91f47cfecb");
    expect(uuid16498[14]).toBe("3");
    expect(["8", "9", "a", "b"]).toContain(uuid16498[19]);
  });

  // 8. Schema/type/documentation consistency
  it("enforces schema, types, and recovery doc consistency with media_backfill_runs and no obsolete codes", () => {
    const dbTypesPath = resolve(__dirname, "../types/database.ts");
    const dbTypesContent = readFileSync(dbTypesPath, "utf-8");

    expect(dbTypesContent).toMatch(/Views:\s*Record<string,\s*never>;/);
    expect(dbTypesContent).not.toContain("canonical_media_summary");
    expect(dbTypesContent).toContain("media_backfill_runs:");

    const schemaSqlPath = resolve(
      __dirname,
      "../supabase/migrations/20261105000000_create_canonical_media_schema.sql",
    );
    const backfillSqlPath = resolve(
      __dirname,
      "../supabase/migrations/20261105000001_backfill_canonical_library.sql",
    );
    const recoveryDocPath = resolve(
      __dirname,
      "../docs/architecture/phase-2b-migration-recovery.md",
    );

    const schemaContent = readFileSync(schemaSqlPath, "utf-8");
    const backfillContent = readFileSync(backfillSqlPath, "utf-8");
    const recoveryDocContent = readFileSync(recoveryDocPath, "utf-8");

    expect(schemaContent).toMatch(/create\s+table\s+if\s+not\s+exists\s+public\.media_backfill_runs/i);
    expect(schemaContent).not.toMatch(/create\s+view/i);
    expect(backfillContent).not.toMatch(/create\s+view/i);
    expect(schemaContent).not.toContain("canonical_media_summary");
    expect(backfillContent).not.toContain("canonical_media_summary");

    // Obsolete codes must not be in recovery docs
    expect(recoveryDocContent).not.toContain("'conflicting-alternate-key-id'");
    expect(recoveryDocContent).not.toContain("'conflicting-alternate-key-episode-id'");
    expect(recoveryDocContent).toContain("media_backfill_runs");
  });
});
