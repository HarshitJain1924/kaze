import { describe, expect, it } from "vitest";

import { calculateScreenStats } from "@/features/stats/calculate-screen-stats";
import type { TmdbLibraryEntry, TmdbWatchedEpisode } from "@/types/tmdb";

function entry(overrides: Partial<TmdbLibraryEntry>): TmdbLibraryEntry {
  return {
    id: "entry-1",
    userId: "user-1",
    tmdbId: 1,
    mediaType: "movie",
    title: "Test Title",
    originalTitle: null,
    overview: null,
    posterPath: null,
    backdropPath: null,
    releaseDate: null,
    status: "completed",
    score: null,
    notes: null,
    watched: false,
    totalEpisodes: null,
    startedAt: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function episode(
  overrides: Partial<TmdbWatchedEpisode>,
): TmdbWatchedEpisode {
  return {
    id: "episode-1",
    entryId: "entry-1",
    userId: "user-1",
    seasonNumber: 1,
    episodeNumber: 1,
    watchedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("calculateScreenStats", () => {
  it("returns zeroed stats for an empty library", () => {
    expect(calculateScreenStats([], [])).toEqual({
      total: 0,
      movieCount: 0,
      tvCount: 0,
      watchedFilms: 0,
      episodesWatched: 0,
      statusCounts: {
        watching: 0,
        completed: 0,
        planning: 0,
        on_hold: 0,
        dropped: 0,
      },
      scoredCount: 0,
      averageScore: null,
    });
  });

  it("splits films and series and counts watched films", () => {
    const stats = calculateScreenStats(
      [
        entry({ id: "a", mediaType: "movie", watched: true }),
        entry({ id: "b", mediaType: "movie", watched: false }),
        entry({ id: "c", mediaType: "tv", status: "watching" }),
      ],
      [],
    );

    expect(stats.total).toBe(3);
    expect(stats.movieCount).toBe(2);
    expect(stats.tvCount).toBe(1);
    expect(stats.watchedFilms).toBe(1);
    expect(stats.statusCounts.watching).toBe(1);
    expect(stats.statusCounts.completed).toBe(2);
  });

  it("averages scores to one decimal and ignores unrated entries", () => {
    const stats = calculateScreenStats(
      [
        entry({ id: "a", score: 8 }),
        entry({ id: "b", score: 7 }),
        entry({ id: "c", score: 9 }),
        entry({ id: "d", score: null }),
      ],
      [],
    );

    expect(stats.scoredCount).toBe(3);
    expect(stats.averageScore).toBe(8);
  });

  it("counts only episodes that belong to tracked entries", () => {
    const stats = calculateScreenStats(
      [entry({ id: "show-1", mediaType: "tv" })],
      [
        episode({ id: "e1", entryId: "show-1" }),
        episode({ id: "e2", entryId: "show-1", episodeNumber: 2 }),
        episode({ id: "e3", entryId: "removed-show" }),
      ],
    );

    expect(stats.episodesWatched).toBe(2);
  });
});
