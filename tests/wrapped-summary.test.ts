import { describe, expect, it } from "vitest";

import { archiveRangeLabel, summarizeScreenLibrary } from "@/lib/wrapped";
import type { TmdbLibraryItem } from "@/types/tmdb";

function screenItem(
  overrides: Partial<TmdbLibraryItem["entry"]> & {
    watchedCount?: number;
  },
): TmdbLibraryItem {
  const { watchedCount = 0, ...entry } = overrides;
  return {
    entry: {
      id: entry.id ?? "entry",
      userId: "user",
      tmdbId: entry.tmdbId ?? 1,
      mediaType: entry.mediaType ?? "movie",
      title: entry.title ?? "Title",
      originalTitle: null,
      overview: null,
      posterPath: null,
      backdropPath: null,
      releaseDate: null,
      status: entry.status ?? "watching",
      score: null,
      notes: null,
      watched: entry.watched ?? false,
      totalEpisodes: entry.totalEpisodes ?? null,
      startedAt: null,
      completedAt: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    },
    watchedEpisodes: [],
    watchedCount,
  };
}

describe("wrapped screen summary", () => {
  it("separates films and series and estimates runtime", () => {
    const summary = summarizeScreenLibrary([
      screenItem({ id: "m1", mediaType: "movie", watched: true }),
      screenItem({ id: "m2", mediaType: "movie", status: "planning" }),
      screenItem({
        id: "t1",
        mediaType: "tv",
        status: "completed",
        watchedCount: 20,
      }),
      screenItem({ id: "t2", mediaType: "tv", status: "watching", watchedCount: 4 }),
    ]);

    expect(summary.filmsTracked).toBe(2);
    expect(summary.filmsWatched).toBe(1);
    expect(summary.seriesTracked).toBe(2);
    expect(summary.seriesFinished).toBe(1);
    expect(summary.episodesWatched).toBe(24);
    // 1 film at 2h + 24 episodes at 45 min = 20h
    expect(summary.estimatedHours).toBe(20);
  });

  it("returns zeros for an empty screen library", () => {
    expect(summarizeScreenLibrary([])).toEqual({
      filmsTracked: 0,
      filmsWatched: 0,
      seriesTracked: 0,
      seriesFinished: 0,
      episodesWatched: 0,
      estimatedHours: 0,
    });
  });
});

describe("wrapped archive label", () => {
  it("spans the oldest tracked year", () => {
    expect(
      archiveRangeLabel(
        ["2024-03-02T00:00:00.000Z", "2025-06-01T00:00:00.000Z"],
        new Date("2026-11-13T00:00:00Z"),
      ),
    ).toBe("2024–2026 archive");
  });

  it("collapses to a single year and falls back without dates", () => {
    expect(
      archiveRangeLabel(["2026-01-04T00:00:00.000Z"], new Date("2026-11-13T00:00:00Z")),
    ).toBe("2026 archive");
    expect(archiveRangeLabel([null, undefined])).toBe("All-time archive");
  });
});
