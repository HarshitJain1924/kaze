import { describe, expect, it } from "vitest";

import { calculateStats } from "@/features/stats/calculate-stats";
import type { AnimeSummary } from "@/types/anime";
import type { LibraryEntry, LibraryItem, WatchStatus } from "@/types/library";

function makeAnime(overrides: Partial<AnimeSummary> = {}): AnimeSummary {
  return {
    id: 1,
    title: { romaji: "Test", english: "Test", native: null },
    coverImage: { extraLarge: null, large: null, color: null },
    format: "TV",
    episodes: 12,
    averageScore: 80,
    seasonYear: 2024,
    status: "FINISHED",
    genres: ["Action"],
    ...overrides,
  };
}

function makeItem({
  status = "watching",
  progress = 0,
  score = null,
  anime = makeAnime(),
  anilistId = 1,
}: {
  status?: WatchStatus;
  progress?: number;
  score?: number | null;
  anime?: AnimeSummary | null;
  anilistId?: number;
}): LibraryItem {
  const entry: LibraryEntry = {
    id: `entry-${anilistId}`,
    userId: "user-1",
    anilistId,
    status,
    progress,
    score,
    startedAt: null,
    completedAt: null,
    notes: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  return { entry, anime };
}

describe("calculateStats", () => {
  it("returns empty statistics for an empty library", () => {
    const stats = calculateStats([]);
    expect(stats.total).toBe(0);
    expect(stats.episodesWatched).toBe(0);
    expect(stats.averageScore).toBeNull();
    expect(stats.statusCounts).toEqual({
      watching: 0,
      completed: 0,
      planning: 0,
      on_hold: 0,
      dropped: 0,
    });
    expect(stats.scoreDistribution).toHaveLength(10);
    expect(stats.scoreDistribution.every((bucket) => bucket.count === 0)).toBe(
      true,
    );
    expect(stats.genreDistribution).toEqual([]);
  });

  it("summarizes statuses, episodes and genres", () => {
    const stats = calculateStats([
      makeItem({
        status: "watching",
        progress: 5,
        score: 8,
        anime: makeAnime({ id: 1, episodes: 12, genres: ["Action", "Drama"] }),
      }),
      makeItem({
        status: "completed",
        progress: 24,
        score: 10,
        anilistId: 2,
        anime: makeAnime({ id: 2, episodes: 24, genres: ["Action"] }),
      }),
      makeItem({
        status: "planning",
        progress: 0,
        anilistId: 3,
        anime: makeAnime({ id: 3, episodes: null, genres: [] }),
      }),
    ]);

    expect(stats.total).toBe(3);
    expect(stats.statusCounts).toMatchObject({
      watching: 1,
      completed: 1,
      planning: 1,
    });
    expect(stats.episodesWatched).toBe(29);
    expect(stats.averageScore).toBe(9);
    expect(stats.scoredCount).toBe(2);
    expect(stats.entriesWithUnknownEpisodeTotals).toBe(0);
    expect(stats.missingMetadataCount).toBe(0);
    expect(stats.genreDistribution).toEqual([
      { genre: "Action", count: 2 },
      { genre: "Drama", count: 1 },
    ]);
    expect(stats.scoreDistribution[7]).toEqual({ score: 8, count: 1 });
    expect(stats.scoreDistribution[9]).toEqual({ score: 10, count: 1 });
  });

  it("counts entries with unknown totals only when progress exists", () => {
    const stats = calculateStats([
      makeItem({
        progress: 3,
        anime: makeAnime({ id: 1, episodes: null }),
      }),
      makeItem({
        progress: 2,
        anilistId: 2,
        anime: null,
      }),
      makeItem({
        progress: 0,
        anilistId: 3,
        anime: makeAnime({ id: 3, episodes: 0 }),
      }),
    ]);

    expect(stats.entriesWithUnknownEpisodeTotals).toBe(2);
    expect(stats.missingMetadataCount).toBe(1);
    expect(stats.episodesWatched).toBe(5);
  });

  it("rounds the average rating to one decimal", () => {
    const stats = calculateStats([
      makeItem({ score: 7 }),
      makeItem({ anilistId: 2, score: 8 }),
      makeItem({ anilistId: 3, score: 8 }),
    ]);
    expect(stats.averageScore).toBe(7.7);
  });

  it("does not count null or out-of-range ratings as scored", () => {
    const stats = calculateStats([
      makeItem({ score: null }),
      makeItem({ anilistId: 2, score: 0 }),
    ]);
    expect(stats.scoredCount).toBe(1);
    expect(stats.averageScore).toBe(1);
  });
});
