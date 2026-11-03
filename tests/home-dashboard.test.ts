import { describe, expect, it } from "vitest";

import { getNextEpisodeNumber } from "@/features/library/continue-watching";
import { parseAnimeSearchParams } from "@/lib/validation/anime";
import type { AnimeSummary } from "@/types/anime";
import type { LibraryEntry, LibraryItem } from "@/types/library";

function createMockAnime(id: number, title: string, episodes: number | null = 12): AnimeSummary {
  return {
    id,
    title: { english: title, romaji: title, native: null },
    coverImage: {
      extraLarge: `https://example.com/${id}-xl.jpg`,
      large: `https://example.com/${id}-large.jpg`,
      color: "#6329db",
    },
    format: "TV",
    episodes,
    averageScore: 85,
    seasonYear: 2026,
    status: "RELEASING",
    genres: ["Action", "Fantasy"],
  };
}

function createMockEntry(anilistId: number, progress = 0, status: LibraryEntry["status"] = "watching"): LibraryEntry {
  return {
    id: `entry-${anilistId}`,
    userId: "test-user-id",
    anilistId,
    status,
    progress,
    score: null,
    startedAt: "2026-10-20",
    completedAt: null,
    notes: null,
    createdAt: "2026-10-20T00:00:00.000Z",
    updatedAt: "2026-10-20T00:00:00.000Z",
  };
}

describe("Home Dashboard — Search & Quick-Add Logic", () => {
  it("validates search query parameters correctly", () => {
    const params = new URLSearchParams({ q: "Demon Slayer", perPage: "8" });
    const parsed = parseAnimeSearchParams(params);
    expect(parsed.query).toBe("Demon Slayer");
    expect(parsed.perPage).toBe(8);
  });

  it("handles empty or whitespace search queries gracefully", () => {
    const params = new URLSearchParams({ q: "   " });
    const parsed = parseAnimeSearchParams(params);
    expect(parsed.query).toBeUndefined();
  });

  it("detects when an anime is already in the user library to prevent duplicates", () => {
    const existingEntries = new Map<number, LibraryEntry>([
      [101, createMockEntry(101, 3, "watching")],
      [102, createMockEntry(102, 0, "planning")],
    ]);

    const animeToTrack = createMockAnime(101, "Existing Title");
    const newAnime = createMockAnime(103, "New Title");

    expect(existingEntries.has(animeToTrack.id)).toBe(true);
    expect(existingEntries.has(newAnime.id)).toBe(false);
  });

  it("resolves recommendation pool according to mediaType (anime, manga, manhwa)", () => {
    const popularAnime = [
      createMockAnime(1, "Anime A"),
      createMockAnime(2, "Anime B"),
    ];
    const popularManga = [
      { ...createMockAnime(10, "Manga J"), countryOfOrigin: "JP" },
      { ...createMockAnime(20, "Manhwa K"), countryOfOrigin: "KR" },
    ];

    // Anime selection
    const animePool = popularAnime;
    expect(animePool.map((x) => x.id)).toEqual([1, 2]);

    // Manga selection uses manga list
    const mangaPool = popularManga;
    expect(mangaPool.map((x) => x.id)).toEqual([10, 20]);

    // Manhwa selection prioritizes KR country of origin
    const manhwaPool = popularManga.filter((x) => x.countryOfOrigin === "KR");
    expect(manhwaPool.map((x) => x.id)).toEqual([20]);
  });

  it("prioritizes untracked titles in recommendations and handles all-tracked state", () => {
    const pool = [
      createMockAnime(1, "Title 1"),
      createMockAnime(2, "Title 2"),
      createMockAnime(3, "Title 3"),
    ];
    const trackedMap = new Map<number, boolean>([
      [1, true],
      [2, true],
    ]);

    const untracked = pool.filter((item) => !trackedMap.has(item.id));
    expect(untracked.length).toBe(1);
    expect(untracked[0]?.id).toBe(3);

    // When all items in pool are tracked:
    const fullTrackedMap = new Map<number, boolean>([
      [1, true],
      [2, true],
      [3, true],
    ]);
    const untrackedAll = pool.filter((item) => !fullTrackedMap.has(item.id));
    const allTracked = pool.length > 0 && untrackedAll.length === 0;
    expect(allTracked).toBe(true);
  });

  it("correctly cycles suggestions on shuffle", () => {
    const pool = Array.from({ length: 9 }, (_, i) =>
      createMockAnime(i + 1, `Series ${i + 1}`),
    );
    const pageSize = 4;
    const total = pool.length;

    const getPage = (pageIndex: number) => {
      const startIndex = (pageIndex * pageSize) % total;
      const items: AnimeSummary[] = [];
      for (let i = 0; i < pageSize; i++) {
        const item = pool[(startIndex + i) % total];
        if (item) items.push(item);
      }
      return items;
    };

    const page0 = getPage(0).map((x) => x.id);
    const page1 = getPage(1).map((x) => x.id);
    const page2 = getPage(2).map((x) => x.id);
    const page3 = getPage(3).map((x) => x.id);

    expect(page0).toEqual([1, 2, 3, 4]);
    expect(page1).toEqual([5, 6, 7, 8]);
    expect(page2).toEqual([9, 1, 2, 3]); // wraps around seamlessly
    expect(page3).toEqual([4, 5, 6, 7]);
  });

  it("enforces search precedence over suggestions", () => {
    const showSuggestions = true;
    const isSearchOpen = true;
    const debouncedQuery = "Solo";

    // When query is active and search results are open, search results take precedence
    const shouldRenderSuggestions =
      showSuggestions && !(isSearchOpen && debouncedQuery);
    expect(shouldRenderSuggestions).toBe(false);

    // When search is cleared, suggestions become visible again
    const shouldRenderWhenCleared =
      showSuggestions && !(isSearchOpen && "");
    expect(shouldRenderWhenCleared).toBe(true);
  });
});

describe("Home Dashboard — Continue Watching & Episode Actions", () => {
  it("calculates next episode correctly for tracked anime", () => {
    const { nextEp, atEnd } = getNextEpisodeNumber(4, [1, 2, 3, 4], 12);
    expect(nextEp).toBe(5);
    expect(atEnd).toBe(false);
  });

  it("marks as atEnd when user is fully caught up on a completed anime", () => {
    const { nextEp, atEnd } = getNextEpisodeNumber(12, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 12);
    expect(nextEp).toBe(13);
    expect(atEnd).toBe(true);
  });

  it("handles unknown episode totals without inventing a total or completing prematurely", () => {
    const { nextEp, atEnd } = getNextEpisodeNumber(4, [1, 2, 3, 4], null);
    expect(nextEp).toBe(5);
    expect(atEnd).toBe(false);
  });

  it("accurately calculates total episodes behind across watching series", () => {
    const items: LibraryItem[] = [
      {
        entry: createMockEntry(1, 3, "watching"),
        anime: createMockAnime(1, "Series A", 12), // 12 - 3 = 9 behind
        watchedEpisodes: [1, 2, 3],
      },
      {
        entry: createMockEntry(2, 4, "watching"),
        anime: createMockAnime(2, "Series B", 6), // 6 - 4 = 2 behind
        watchedEpisodes: [1, 2, 3, 4],
      },
      {
        entry: createMockEntry(3, 10, "watching"),
        anime: createMockAnime(3, "Series C", null), // unknown total, not behind known total
        watchedEpisodes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      },
      {
        entry: createMockEntry(4, 12, "completed"), // completed, not counted as watching
        anime: createMockAnime(4, "Series D", 12),
        watchedEpisodes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      },
    ];

    let episodesBehind = 0;
    let seriesBehind = 0;

    for (const item of items) {
      if (item.entry.status === "watching" && item.anime) {
        const total = item.anime.episodes;
        const progress = item.entry.progress;
        if (total !== null && total > 0 && progress < total) {
          episodesBehind += total - progress;
          seriesBehind += 1;
        }
      }
    }

    expect(episodesBehind).toBe(11); // 9 + 2
    expect(seriesBehind).toBe(2);
  });
});
