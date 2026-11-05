import { describe, expect, it } from "vitest";

import {
  assertMediaLibraryItem,
  deterministicAniListMediaId,
  planLegacyBackfill,
  validateMediaLibraryEntry,
  MediaLibraryInvariantError,
  type BackfillOptions,
  type LegacyUserAnimeEpisodeRow,
  type LegacyUserAnimeRow,
} from "@/lib/media/persistence";
import { toCanonicalMediaId, type CanonicalMediaId, type MediaLibraryEntry, type MediaSummary } from "@/types/media";

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
  const validEntry: MediaLibraryEntry = {
    id: "entry-1",
    userId: "user-1",
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

  it("rejects invalid score ranges", () => {
    expect(() => validateMediaLibraryEntry({ ...validEntry, score: 0 })).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => validateMediaLibraryEntry({ ...validEntry, score: 11 })).toThrow(
      MediaLibraryInvariantError,
    );
    expect(() => validateMediaLibraryEntry({ ...validEntry, score: 8.5 })).toThrow(
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
