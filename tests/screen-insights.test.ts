import { describe, expect, it } from "vitest";

import { calculateScreenInsights } from "@/features/stats/calculate-screen-insights";
import type { TmdbLibraryItem } from "@/types/tmdb";

function item(overrides: {
  id: string;
  mediaType?: "movie" | "tv";
  tmdbId?: number;
  title?: string;
  status?: TmdbLibraryItem["entry"]["status"];
  score?: number | null;
  watched?: boolean;
  totalEpisodes?: number | null;
  releaseDate?: string | null;
  watchedCount?: number;
  updatedAt?: string;
  watchedAt?: string[];
}): TmdbLibraryItem {
  return {
    entry: {
      id: overrides.id,
      userId: "user",
      tmdbId: overrides.tmdbId ?? 1,
      mediaType: overrides.mediaType ?? "movie",
      title: overrides.title ?? overrides.id,
      originalTitle: null,
      overview: null,
      posterPath: null,
      backdropPath: null,
      releaseDate: overrides.releaseDate ?? null,
      status: overrides.status ?? "planning",
      score: overrides.score ?? null,
      notes: null,
      watched: overrides.watched ?? false,
      totalEpisodes: overrides.totalEpisodes ?? null,
      startedAt: null,
      completedAt: null,
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: overrides.updatedAt ?? "2025-01-01T00:00:00.000Z",
    },
    watchedEpisodes: (overrides.watchedAt ?? []).map((watchedAt, index) => ({
      id: `${overrides.id}-ep-${index}`,
      entryId: overrides.id,
      userId: "user",
      seasonNumber: 1,
      episodeNumber: index + 1,
      watchedAt,
    })),
    watchedCount: overrides.watchedCount ?? 0,
  };
}

describe("calculateScreenInsights", () => {
  it("buckets film ratings, decades and watch rate", () => {
    const insights = calculateScreenInsights(
      [
        item({
          id: "a",
          tmdbId: 10,
          score: 10,
          watched: true,
          status: "completed",
          releaseDate: "2021-10-01",
        }),
        item({
          id: "b",
          tmdbId: 11,
          score: 8,
          status: "watching",
          releaseDate: "1999-05-01",
        }),
        item({ id: "c", tmdbId: 12, score: 6, status: "planning", releaseDate: "1994-01-01" }),
        item({ id: "d", tmdbId: 13, watched: true }),
      ],
      "movie",
    );

    expect(insights.count).toBe(4);
    expect(insights.ratedCount).toBe(3);
    expect(insights.meanScore).toBe(8);
    expect(insights.scoreBuckets).toEqual([
      { label: "10", count: 1 },
      { label: "9", count: 0 },
      { label: "8", count: 1 },
      { label: "7", count: 0 },
      { label: "≤6", count: 1 },
    ]);
    expect(insights.decades).toEqual([
      { label: "2020s", count: 1 },
      { label: "1990s", count: 2 },
    ]);
    expect(insights.watchedFilms).toBe(2);
    expect(insights.watchRate).toBe(50);
    expect(insights.queuedFilms).toBe(2);
    expect(insights.topRated.map((entry) => entry.tmdbId)).toEqual([10, 11]);
  });

  it("measures series coverage and ranks progress", () => {
    const insights = calculateScreenInsights(
      [
        item({
          id: "s1",
          mediaType: "tv",
          tmdbId: 20,
          title: "Twenty",
          status: "watching",
          totalEpisodes: 20,
          watchedCount: 12,
        }),
        item({
          id: "s2",
          mediaType: "tv",
          tmdbId: 21,
          title: "Ten",
          status: "completed",
          totalEpisodes: 10,
          watchedCount: 10,
        }),
        item({ id: "film", mediaType: "movie", tmdbId: 22 }),
      ],
      "tv",
    );

    expect(insights.count).toBe(2);
    expect(insights.episodesWatched).toBe(22);
    expect(insights.episodesAvailable).toBe(30);
    expect(insights.episodeCompletion).toBe(73);
    expect(insights.seriesProgress.map((series) => series.title)).toEqual([
      "Twenty",
      "Ten",
    ]);
    expect(insights.watchedFilms).toBe(0);
  });

  it("measures streaks, pace and the backlog runway from watch timestamps", () => {
    const now = new Date(2026, 10, 13, 12);
    const insights = calculateScreenInsights(
      [
        item({
          id: "s",
          mediaType: "tv",
          tmdbId: 30,
          status: "watching",
          totalEpisodes: 20,
          watchedCount: 4,
          watchedAt: [
            new Date(2026, 10, 10, 21).toISOString(),
            new Date(2026, 10, 11, 21).toISOString(),
            new Date(2026, 10, 12, 21).toISOString(),
            new Date(2026, 10, 13, 9).toISOString(),
          ],
        }),
      ],
      "tv",
      now,
    );

    expect(insights.activity.activeDays).toBe(4);
    expect(insights.activity.currentStreak).toBe(4);
    expect(insights.activity.longestStreak).toBe(4);
    expect(insights.activity.recentEpisodes).toBe(4);
    expect(insights.activity.weeklyPace).toBe(1);
    expect(
      insights.activity.weekdayCounts.reduce((sum, count) => sum + count, 0),
    ).toBe(4);
    expect(insights.backlog.episodes).toBe(16);
    expect(insights.backlog.hours).toBe(12);
    expect(insights.backlog.weeksToClear).toBe(16);
    expect(insights.backlog.clearBy).toBe("Mar 2027");
  });

  it("has no projection without recent activity", () => {
    const insights = calculateScreenInsights(
      [
        item({
          id: "q",
          mediaType: "movie",
          status: "planning",
        }),
      ],
      "movie",
      new Date(2026, 10, 13, 12),
    );

    expect(insights.backlog.films).toBe(1);
    expect(insights.backlog.hours).toBe(2);
    expect(insights.backlog.weeksToClear).toBeNull();
    expect(insights.backlog.clearBy).toBeNull();
    expect(insights.activity.weeklyPace).toBeNull();
  });

  it("handles an empty archive", () => {
    const insights = calculateScreenInsights([], "tv");
    expect(insights.count).toBe(0);
    expect(insights.meanScore).toBeNull();
    expect(insights.episodeCompletion).toBeNull();
    expect(insights.recent).toEqual([]);
  });
});
