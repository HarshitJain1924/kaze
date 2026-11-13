import { describe, expect, it } from "vitest";

import {
  SMART_LIST_PRESETS,
  listItemsFor,
  resolveSmartListItems,
} from "@/lib/smart-lists";
import type { LibraryEntry, LibraryItem } from "@/types/library";
import type { TmdbLibraryItem } from "@/types/tmdb";

function animeItem(options: {
  anilistId: number;
  english: string;
  score?: number | null;
  status?: LibraryEntry["status"];
  progress?: number;
  episodes?: number | null;
  mediaType?: "anime" | "manga";
}): LibraryItem {
  return {
    entry: {
      id: `entry-${options.anilistId}`,
      userId: "user",
      anilistId: options.anilistId,
      mediaType: options.mediaType ?? "anime",
      status: options.status ?? "watching",
      progress: options.progress ?? 0,
      volumesProgress: 0,
      score: options.score ?? null,
      startedAt: null,
      completedAt: null,
      notes: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
    anime: {
      id: options.anilistId,
      title: { romaji: options.english, english: options.english, native: null },
      coverImage: { extraLarge: null, large: "https://example.test/cover.jpg", color: null },
      format: "TV",
      episodes: options.episodes === undefined ? 12 : options.episodes,
      averageScore: 80,
      genres: [],
      seasonYear: 2024,
      status: "FINISHED",
    },
  };
}

function screenItem(options: {
  id: string;
  mediaType?: "movie" | "tv";
  title: string;
  score?: number | null;
  status?: LibraryEntry["status"];
  watchedCount?: number;
  totalEpisodes?: number | null;
}): TmdbLibraryItem {
  return {
    entry: {
      id: options.id,
      userId: "user",
      tmdbId: Number(options.id.replace(/\D/g, "")) || 1,
      mediaType: options.mediaType ?? "movie",
      title: options.title,
      originalTitle: null,
      overview: null,
      posterPath: "https://example.test/poster.jpg",
      backdropPath: null,
      releaseDate: "2024-01-01",
      status: options.status ?? "completed",
      score: options.score ?? null,
      notes: null,
      watched: true,
      totalEpisodes: options.totalEpisodes ?? null,
      startedAt: null,
      completedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    },
    watchedEpisodes: [],
    watchedCount: options.watchedCount ?? 0,
  };
}

describe("smart collections", () => {
  it("selects themed films and series at or above the score", () => {
    const screen = [
      screenItem({ id: "movie-1", title: "Perfect Blue", score: 9 }),
      screenItem({ id: "movie-2", title: "Paprika", score: 8 }),
      screenItem({ id: "movie-3", title: "Unrated", score: null }),
      screenItem({ id: "show-4", mediaType: "tv", title: "Serial Experiments Lain", score: 10 }),
    ];

    const items = resolveSmartListItems(
      { type: "score_min", min: 8, scope: "screen" },
      [],
      screen,
    );

    expect(items.map((item) => item.title)).toEqual([
      "Paprika",
      "Perfect Blue",
      "Serial Experiments Lain",
    ]);
    expect(items[0]?.tmdbId).toBe(2);
    expect(items[0]?.tmdbKind).toBe("movie");
  });

  it("keeps unrated anime but leaves untouched planning entries out", () => {
    const library = [
      animeItem({ anilistId: 1, english: "Watching, unrated", status: "watching" }),
      animeItem({ anilistId: 2, english: "Planned", status: "planning" }),
      animeItem({ anilistId: 3, english: "Scored", score: 8 }),
      animeItem({ anilistId: 4, english: "Manga, unrated", status: "completed", mediaType: "manga" }),
    ];

    const items = resolveSmartListItems(
      { type: "unrated", scope: "anime" },
      library,
      [],
    );

    expect(items.map((item) => item.title)).toEqual(["Manga, unrated", "Watching, unrated"]);
    expect(items[0]?.anilistId).toBe(4);
    expect(items[0]?.mediaType).toBe("manga");
  });

  it("merges both catalogues for a status rule", () => {
    const library = [
      animeItem({ anilistId: 10, english: "Dropped anime", status: "dropped" }),
      animeItem({ anilistId: 11, english: "Kept", status: "watching" }),
    ];
    const screen = [
      screenItem({ id: "movie-20", title: "Dropped film", status: "dropped" }),
    ];

    const items = resolveSmartListItems({ type: "status", status: "dropped" }, library, screen);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.title).sort()).toEqual(["Dropped anime", "Dropped film"]);
  });

  it("only lists unfinished series with a known remainder", () => {
    const library = [
      animeItem({ anilistId: 30, english: "Mid-season", progress: 3, episodes: 12 }),
      animeItem({ anilistId: 31, english: "Finished", progress: 12, episodes: 12, status: "completed" }),
      animeItem({ anilistId: 32, english: "Unknown total", progress: 2, episodes: null }),
    ];
    const screen = [
      screenItem({
        id: "show-40",
        mediaType: "tv",
        title: "Half watched series",
        status: "watching",
        watchedCount: 4,
        totalEpisodes: 10,
      }),
      screenItem({
        id: "show-41",
        mediaType: "tv",
        title: "Complete series",
        status: "completed",
        watchedCount: 10,
        totalEpisodes: 10,
      }),
    ];

    const items = resolveSmartListItems({ type: "unfinished" }, library, screen);

    expect(items.map((item) => item.title).sort()).toEqual([
      "Half watched series",
      "Mid-season",
    ]);
  });

  it("renders stored items for a hand-built list and resolves rules only when present", () => {
    const stored = [
      {
        id: "item_1",
        anilistId: 99,
        title: "Stored pick",
        coverImage: null,
        addedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    expect(listItemsFor({ items: stored }, [], [])).toBe(stored);
    expect(
      listItemsFor(
        { items: [], rule: { type: "status", status: "dropped" } },
        [animeItem({ anilistId: 50, english: "Dropped", status: "dropped" })],
        [],
      ),
    ).toHaveLength(1);
  });

  it("ships presets that all resolve without throwing", () => {
    expect(SMART_LIST_PRESETS.length).toBeGreaterThan(0);
    for (const preset of SMART_LIST_PRESETS) {
      expect(() => resolveSmartListItems(preset.rule, [], [])).not.toThrow();
    }
  });
});
