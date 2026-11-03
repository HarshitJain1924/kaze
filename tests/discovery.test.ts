import { describe, expect, it } from "vitest";

import {
  calculatePersonalContext,
  curateReadingTable,
  deduplicateSeasonal,
  deduplicateTrending,
  selectSpotlightCandidates,
} from "@/lib/discovery";
import type { AiringScheduleEntry, AnimeSummary } from "@/types/anime";
import type { LibraryEntry, LibraryItem } from "@/types/library";

function createMockAnime(
  id: number,
  title: string,
  options: {
    averageScore?: number;
    seasonYear?: number;
    bannerImage?: string | null;
    genres?: string[];
    countryOfOrigin?: string;
    episodes?: number | null;
    status?: "FINISHED" | "RELEASING" | "NOT_YET_RELEASED";
  } = {},
): AnimeSummary {
  return {
    id,
    title: { english: title, romaji: title, native: null },
    coverImage: {
      extraLarge: `https://example.com/${id}-xl.jpg`,
      large: `https://example.com/${id}-l.jpg`,
      color: "#ff5500",
    },
    bannerImage: options.bannerImage !== undefined ? options.bannerImage : `https://example.com/${id}-banner.jpg`,
    format: "TV",
    episodes: options.episodes !== undefined ? options.episodes : 12,
    averageScore: options.averageScore ?? 85,
    seasonYear: options.seasonYear ?? 2026,
    status: options.status ?? "RELEASING",
    genres: options.genres ?? ["Action"],
    countryOfOrigin: options.countryOfOrigin ?? "JP",
  };
}

function createMockLibraryItem(
  anime: AnimeSummary,
  progress = 0,
  status: LibraryEntry["status"] = "watching",
): LibraryItem {
  return {
    entry: {
      id: `entry-${anime.id}`,
      userId: "test-user",
      anilistId: anime.id,
      status,
      progress,
      score: null,
      startedAt: "2026-01-01",
      completedAt: null,
      notes: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
    anime,
    watchedEpisodes: Array.from({ length: progress }, (_, i) => i + 1),
  };
}

describe("Discovery Intelligence — Spotlight Selection", () => {
  it("selects candidates with high visual quality (bannerImage) and genre diversity", () => {
    const seasonal = [
      createMockAnime(1, "Action Hit A", { genres: ["Action"], averageScore: 90, bannerImage: "banner1.jpg" }),
      createMockAnime(2, "Action Hit B", { genres: ["Action"], averageScore: 88, bannerImage: "banner2.jpg" }),
      createMockAnime(3, "Fantasy Quest", { genres: ["Fantasy"], averageScore: 87, bannerImage: "banner3.jpg" }),
      createMockAnime(4, "Slice of Life", { genres: ["Slice of Life"], averageScore: 86, bannerImage: "banner4.jpg" }),
      createMockAnime(5, "Sci-Fi Wonder", { genres: ["Sci-Fi"], averageScore: 85, bannerImage: "banner5.jpg" }),
      createMockAnime(6, "No Banner Anime", { genres: ["Action"], averageScore: 99, bannerImage: null }),
    ];

    const candidates = selectSpotlightCandidates(seasonal, [], [], { currentYear: 2026 });

    expect(candidates.length).toBe(5);
    // Highest score with banner is selected as primary
    expect(candidates[0]?.id).toBe(1);
    // Diverse genres are included
    const genres = candidates.map((c) => c.genres[0]);
    expect(genres).toContain("Fantasy");
    expect(genres).toContain("Slice of Life");
    expect(genres).toContain("Sci-Fi");
  });

  it("falls back gracefully when titles lack banners", () => {
    const items = [
      createMockAnime(10, "Title 10", { bannerImage: null, averageScore: 80 }),
      createMockAnime(11, "Title 11", { bannerImage: null, averageScore: 85 }),
    ];

    const candidates = selectSpotlightCandidates(items, [], []);
    expect(candidates.length).toBe(2);
    expect(candidates[0]?.id).toBe(11);
  });
});

describe("Discovery Intelligence — Deduplication Across Sections", () => {
  it("deduplicates the seasonal catalogue against the primary hero without dropping items", () => {
    const seasonal = [
      createMockAnime(1, "Featured Hero"),
      createMockAnime(2, "Seasonal Two"),
      createMockAnime(3, "Seasonal Three"),
      createMockAnime(4, "Seasonal Four"),
      createMockAnime(5, "Seasonal Five"),
      createMockAnime(6, "Seasonal Six"),
      createMockAnime(7, "Seasonal Seven"),
    ];

    const deduplicated = deduplicateSeasonal(seasonal, 1);
    expect(deduplicated.length).toBe(7);
    // Primary hero is moved after opening highlights
    expect(deduplicated[0]?.id).toBe(2);
    expect(deduplicated[deduplicated.length - 1]?.id).toBe(1);
  });

  it("filters the primary hero from the top 6 trending list when alternatives exist", () => {
    const trending = [
      createMockAnime(1, "Featured Hero"),
      createMockAnime(2, "Trending Two"),
      createMockAnime(3, "Trending Three"),
      createMockAnime(4, "Trending Four"),
      createMockAnime(5, "Trending Five"),
      createMockAnime(6, "Trending Six"),
      createMockAnime(7, "Trending Seven"),
    ];

    const deduplicated = deduplicateTrending(trending, 1, 6);
    expect(deduplicated.length).toBe(6);
    expect(deduplicated.some((it) => it.id === 1)).toBe(false);
    expect(deduplicated[0]?.id).toBe(2);
  });

  it("curates On the Reading Table to represent both Manga and Manhwa", () => {
    const mangaPool = [
      createMockAnime(101, "Manga 1", { countryOfOrigin: "JP" }),
      createMockAnime(102, "Manga 2", { countryOfOrigin: "JP" }),
      createMockAnime(103, "Manga 3", { countryOfOrigin: "JP" }),
      createMockAnime(104, "Manga 4", { countryOfOrigin: "JP" }),
      createMockAnime(105, "Manga 5", { countryOfOrigin: "JP" }),
      createMockAnime(201, "Solo Leveling", { countryOfOrigin: "KR" }),
      createMockAnime(202, "Omniscient Reader", { countryOfOrigin: "KR" }),
    ];

    const readingShelf = curateReadingTable(mangaPool, 6);
    expect(readingShelf.length).toBe(6);

    const hasManhwa = readingShelf.some((it) => it.countryOfOrigin === "KR");
    const hasManga = readingShelf.some((it) => it.countryOfOrigin === "JP");
    expect(hasManhwa).toBe(true);
    expect(hasManga).toBe(true);
  });
});

describe("Personal Watch Context — Accurate & Actionable Messaging", () => {
  const fixedNow = new Date("2026-11-04T12:00:00Z"); // 12:00 UTC

  it("distinguishes already-aired episodes today from upcoming broadcasts", () => {
    const anime1 = createMockAnime(1, "Frieren", { status: "RELEASING" });
    const anime2 = createMockAnime(2, "DanDaDan", { status: "RELEASING" });

    // Aired at 10:00 UTC (past)
    const airedEntry: AiringScheduleEntry = {
      id: 101,
      airingAt: Math.floor(new Date("2026-11-04T10:00:00Z").getTime() / 1000),
      timeUntilAiring: -7200,
      episode: 5,
      mediaId: 1,
      media: anime1,
    };

    // Airing at 16:00 UTC (future)
    const upcomingEntry: AiringScheduleEntry = {
      id: 102,
      airingAt: Math.floor(new Date("2026-11-04T16:00:00Z").getTime() / 1000),
      timeUntilAiring: 14400,
      episode: 3,
      mediaId: 2,
      media: anime2,
    };

    const items: LibraryItem[] = [
      createMockLibraryItem(anime1, 4, "watching"),
      createMockLibraryItem(anime2, 2, "watching"),
    ];

    const context = calculatePersonalContext({
      viewer: {
        id: "user-1",
        email: "fan@example.com",
        nickname: "Harshit",
        showAdult: false,
        createdAt: "2026-01-01T00:00:00Z",
      },
      items,
      todayEntries: [airedEntry, upcomingEntry],
      activeTimeZone: "UTC",
      now: fixedNow,
    });

    expect(context.trackedTodayCount).toBe(2);
    expect(context.trackedAiredCount).toBe(1);
    expect(context.trackedUpcomingCount).toBe(1);
    expect(context.summaryText).toContain("Frieren");
    expect(context.summaryText).toContain("more airing later today");
  });

  it("does not report ongoing series caught up to current broadcast as behind", () => {
    const ongoingAnime = createMockAnime(1, "Ongoing Series", {
      status: "RELEASING",
      episodes: 24, // 24 total scheduled, but only 3 released so far!
    });

    const items: LibraryItem[] = [
      createMockLibraryItem(ongoingAnime, 3, "watching"), // watched all 3 released
    ];

    const context = calculatePersonalContext({
      viewer: {
        id: "user-1",
        email: "fan@example.com",
        nickname: "Harshit",
        showAdult: false,
        createdAt: "2026-01-01T00:00:00Z",
      },
      items,
      todayEntries: [], // No broadcast today
      activeTimeZone: "UTC",
      now: fixedNow,
    });

    // Should indicate caught up, NOT "You're 21 episodes behind"!
    expect(context.summaryText).toContain("all caught up with current releases");
  });

  it("accurately reports available episodes for completed series", () => {
    const finishedAnime = createMockAnime(2, "Finished Classic", {
      status: "FINISHED",
      episodes: 12,
    });

    const items: LibraryItem[] = [
      createMockLibraryItem(finishedAnime, 8, "watching"), // 12 - 8 = 4 episodes ready
    ];

    const context = calculatePersonalContext({
      viewer: {
        id: "user-1",
        email: "fan@example.com",
        nickname: "Harshit",
        showAdult: false,
        createdAt: "2026-01-01T00:00:00Z",
      },
      items,
      todayEntries: [],
      activeTimeZone: "UTC",
      now: fixedNow,
    });

    expect(context.readyToWatchCount).toBe(4);
    expect(context.summaryText).toContain("4 episodes ready to watch");
  });

  it("handles guest viewers with informative broadcast context", () => {
    const context = calculatePersonalContext({
      viewer: null,
      items: [],
      todayEntries: [
        {
          id: 1,
          airingAt: Math.floor(fixedNow.getTime() / 1000),
          timeUntilAiring: 0,
          episode: 1,
          mediaId: 99,
          media: createMockAnime(99, "Airing Now"),
        },
      ],
      activeTimeZone: "UTC",
      now: fixedNow,
    });

    expect(context.summaryText).toContain("1 broadcast scheduled today");
    expect(context.summaryText).toContain("Sign in");
  });
});
