import { describe, expect, it } from "vitest";

import { computeLibraryHealth } from "@/lib/library-health";
import type { LibraryEntry, LibraryItem } from "@/types/library";
import type { TmdbLibraryItem } from "@/types/tmdb";

function animeItem(
  anilistId: number,
  options: {
    progress?: number;
    episodes?: number | null;
    chapters?: number | null;
    mediaType?: "anime" | "manga";
    hydrated?: boolean;
  } = {},
): LibraryItem {
  const entry: LibraryEntry = {
    id: `entry-${anilistId}`,
    userId: "user",
    anilistId,
    mediaType: options.mediaType ?? "anime",
    status: "watching",
    progress: options.progress ?? 0,
    score: null,
    startedAt: null,
    completedAt: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };
  return {
    entry,
    anime:
      options.hydrated === false
        ? null
        : {
            id: anilistId,
            title: { romaji: `Title ${anilistId}`, english: `Title ${anilistId}`, native: null },
            coverImage: { extraLarge: null, large: null, color: null },
            format: "TV",
            episodes: options.episodes === undefined ? 12 : options.episodes,
            chapters: options.chapters ?? null,
            averageScore: null,
            genres: [],
            seasonYear: null,
            status: null,
          },
  };
}

function screenItem(
  id: string,
  options: { watchedCount?: number; totalEpisodes?: number | null } = {},
): TmdbLibraryItem {
  return {
    entry: {
      id,
      userId: "user",
      tmdbId: Number(id.replace(/\D/g, "")) || 1,
      mediaType: "tv",
      title: `Series ${id}`,
      originalTitle: null,
      overview: null,
      posterPath: null,
      backdropPath: null,
      releaseDate: null,
      status: "watching",
      score: null,
      notes: null,
      watched: false,
      totalEpisodes: options.totalEpisodes ?? 10,
      startedAt: null,
      completedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
    watchedEpisodes: [],
    watchedCount: options.watchedCount ?? 0,
  };
}

describe("library health", () => {
  it("reports a clean archive when everything lines up", () => {
    const report = computeLibraryHealth(
      [animeItem(1, { progress: 3 })],
      [screenItem("show-1", { watchedCount: 2 })],
    );
    expect(report.clean).toBe(true);
    expect(report.total).toBe(0);
  });

  it("flags progress beyond a known episode total", () => {
    const report = computeLibraryHealth([animeItem(1, { progress: 14, episodes: 12 })], []);
    expect(report.overrun).toHaveLength(1);
    expect(report.overrun[0]?.detail).toContain("14 episodes");
    expect(report.overrun[0]?.href).toBe("/media/1");
  });

  it("flags missing episode totals but not missing manga chapter totals", () => {
    const report = computeLibraryHealth(
      [
        animeItem(1, { episodes: null }),
        animeItem(2, { mediaType: "manga", chapters: null }),
      ],
      [],
    );
    expect(report.missingTotals.map((finding) => finding.title)).toEqual(["Title 1"]);
  });

  it("flags entries whose metadata never loaded", () => {
    const report = computeLibraryHealth([animeItem(5, { hydrated: false })], []);
    expect(report.unhydrated).toHaveLength(1);
    expect(report.unhydrated[0]?.title).toBe("AniList #5");
  });

  it("flags duplicate catalogue ids on both sides", () => {
    const report = computeLibraryHealth(
      [animeItem(1), animeItem(1)],
      [screenItem("show-1"), screenItem("show-1")],
    );
    expect(report.duplicates).toHaveLength(2);
    expect(report.total).toBe(2);
  });

  it("flags series watched past their total", () => {
    const report = computeLibraryHealth([], [screenItem("show-2", { watchedCount: 12 })]);
    expect(report.overrun).toHaveLength(1);
    expect(report.overrun[0]?.href).toBe("/screen/tv/2");
  });
});
