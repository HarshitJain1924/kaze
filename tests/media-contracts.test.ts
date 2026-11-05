import { describe, expect, it } from "vitest";

import {
  MEDIA_ARTWORK_ROLES,
  MEDIA_KINDS,
  MEDIA_PROVIDERS,
  isCanonicalMediaId,
  isMediaArtworkRole,
  isMediaKind,
  isMediaProvider,
  isTvMedia,
  toCanonicalMediaId,
  type CanonicalMediaId,
  type MediaLibraryEntry,
  type MediaLibraryItem,
  type MediaProgress,
  type TvMediaSummary,
} from "@/types/media";

const VALID_UUID = "123e4567-e89b-42d3-a456-426614174000";

function mediaId(value: string = VALID_UUID): CanonicalMediaId {
  const id = toCanonicalMediaId(value);
  if (!id) throw new Error(`Invalid test media id: ${value}`);
  return id;
}

describe("media identity", () => {
  it("normalizes and brands canonical UUIDs", () => {
    const id = toCanonicalMediaId(` ${VALID_UUID.toUpperCase()} `);
    expect(id).toBe(VALID_UUID);
    expect(isCanonicalMediaId(id)).toBe(true);
    expect(isCanonicalMediaId(VALID_UUID.toUpperCase())).toBe(false);
  });

  it("rejects provider IDs and malformed values as canonical IDs", () => {
    expect(toCanonicalMediaId("16498")).toBeNull();
    expect(toCanonicalMediaId("not-a-uuid")).toBeNull();
    expect(isCanonicalMediaId(16498)).toBe(false);
    expect(isCanonicalMediaId(null)).toBe(false);
  });

  it("rejects unsupported UUID versions and variants", () => {
    expect(
      toCanonicalMediaId("123e4567-e89b-02d3-a456-426614174000"),
    ).toBeNull();
    expect(
      toCanonicalMediaId("123e4567-e89b-42d3-7456-426614174000"),
    ).toBeNull();
    expect(
      toCanonicalMediaId("123e4567-e89b-92d3-a456-426614174000"),
    ).toBeNull();
  });

  it("keeps the four supported media kinds explicit", () => {
    expect(MEDIA_KINDS).toEqual(["anime", "manga", "movie", "tv"]);
    for (const kind of MEDIA_KINDS) {
      expect(isMediaKind(kind)).toBe(true);
    }
    expect(isMediaKind("novel")).toBe(false);
    expect(isMediaKind(undefined)).toBe(false);
  });

  it("recognizes provider identifiers separately from canonical IDs", () => {
    expect(MEDIA_PROVIDERS).toContain("anilist");
    expect(MEDIA_PROVIDERS).toContain("tmdb");
    expect(isMediaProvider("anilist")).toBe(true);
    expect(isMediaProvider("tmdb")).toBe(true);
    expect(isMediaProvider("kaze")).toBe(false);
  });
});

describe("media contracts", () => {
  it("keeps artwork roles explicit and validated", () => {
    expect(MEDIA_ARTWORK_ROLES).toEqual([
      "poster",
      "backdrop",
      "banner",
      "logo",
    ]);
    for (const role of MEDIA_ARTWORK_ROLES) {
      expect(isMediaArtworkRole(role)).toBe(true);
    }
    expect(isMediaArtworkRole("cover")).toBe(false);
    expect(isMediaArtworkRole(null)).toBe(false);
  });

  it("models progress as a type-aware union", () => {
    const progress: MediaProgress[] = [
      { kind: "anime", episodesWatched: 4 },
      { kind: "manga", chaptersRead: 20, volumesRead: 3 },
      { kind: "movie", watched: true },
      {
        kind: "tv",
        seasonNumber: 2,
        episodeNumber: 5,
        episodesWatched: 17,
      },
    ];

    expect(progress.map((item) => item.kind)).toEqual([
      "anime",
      "manga",
      "movie",
      "tv",
    ]);
  });

  it("correlates library entry kind with its progress shape", () => {
    const base = {
      id: "entry-1",
      userId: "user-1",
      mediaId: mediaId(),
      status: "watching" as const,
      score: null,
      favorite: false,
      notes: null,
      startedAt: null,
      completedAt: null,
      rewatchCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const animeEntry: MediaLibraryEntry = {
      ...base,
      mediaKind: "anime",
      progress: { kind: "anime", episodesWatched: 3 },
      episodeProgress: [
        {
          seasonNumber: 0,
          episodeNumber: 1,
          watchedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    const mangaEntry: MediaLibraryEntry = {
      ...base,
      mediaKind: "manga",
      progress: { kind: "manga", chaptersRead: 12, volumesRead: 2 },
    };
    const movieEntry: MediaLibraryEntry = {
      ...base,
      mediaKind: "movie",
      progress: { kind: "movie", watched: false },
    };
    const tvEntry: MediaLibraryEntry = {
      ...base,
      mediaKind: "tv",
      progress: {
        kind: "tv",
        seasonNumber: 1,
        episodeNumber: 2,
        episodesWatched: 2,
      },
      episodeProgress: [],
    };

    expect(
      [animeEntry, mangaEntry, movieEntry, tvEntry].map(
        (entry) => entry.mediaKind,
      ),
    ).toEqual(["anime", "manga", "movie", "tv"]);

    const movieItem: MediaLibraryItem = {
      entry: movieEntry,
      media: null,
    };
    expect(movieItem.entry.mediaKind).toBe("movie");
    expect(movieItem.entry.progress.kind).toBe("movie");
  });

  it("rejects progress that contradicts the library entry kind", () => {
    const base = {
      id: "entry-1",
      userId: "user-1",
      mediaId: mediaId(),
      status: "watching" as const,
      score: null,
      favorite: false,
      notes: null,
      startedAt: null,
      completedAt: null,
      rewatchCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const invalidAnimeEntry: MediaLibraryEntry = {
      ...base,
      mediaKind: "anime",
      // @ts-expect-error movie progress is incompatible with an anime entry
      progress: { kind: "movie", watched: true },
    };
    void invalidAnimeEntry;

    // @ts-expect-error movie entries cannot carry episode history
    const invalidMovieEntry: MediaLibraryEntry = {
      ...base,
      mediaKind: "movie",
      progress: { kind: "movie", watched: true },
      episodeProgress: [],
    };
    void invalidMovieEntry;
  });

  it("narrows TV summaries without making type-specific fields global", () => {
    const tv: TvMediaSummary = {
      id: mediaId(),
      kind: "tv",
      title: {
        primary: "The Bear",
        romaji: null,
        english: "The Bear",
        native: null,
      },
      synopsis: null,
      artwork: [],
      genres: ["Drama"],
      releaseYear: 2022,
      releaseStatus: "Returning Series",
      format: "TV",
      communityRating: null,
      providerRefs: [{ provider: "tmdb", externalId: "136315" }],
      isAdult: false,
      seasonCount: 3,
      episodeCount: 28,
    };

    expect(isTvMedia(tv)).toBe(true);
    if (!isTvMedia(tv)) throw new Error("expected TV media");
    expect(tv.seasonCount).toBe(3);
  });
});
