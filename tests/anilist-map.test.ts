import { describe, expect, it, vi } from "vitest";

import { AniListError } from "@/services/anilist/errors";
import {
  mapAnime,
  mapAnimeList,
  mapAnimePage,
  mapAnimeSummary,
} from "@/services/anilist/map";

const rawSummary = {
  id: 16498,
  title: {
    romaji: "Shingeki no Kyojin",
    english: "Attack on Titan",
    native: "進撃の巨人",
  },
  coverImage: {
    extraLarge: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/xl.jpg",
    large: "https://s4.anilist.co/file/anilistcdn/media/anime/cover/l.jpg",
    color: "#e5a55b",
  },
  format: "TV",
  episodes: 25,
  averageScore: 84,
  seasonYear: 2013,
  status: "FINISHED",
  genres: ["Action", "Drama", "Action"],
};

const rawDetails = {
  ...rawSummary,
  bannerImage: "https://s4.anilist.co/file/anilistcdn/media/anime/banner/xl.jpg",
  description:
    "<p>Humanity fights for survival.</p><br><p>Second paragraph &amp; more.</p>",
  season: "SPRING",
  duration: 24,
  popularity: 450000,
  startDate: { year: 2013, month: 4, day: 7 },
  endDate: { year: 2013, month: 9, day: 29 },
  tags: [
    { name: "Military", isMediaSpoiler: false },
    { name: "Tragedy", isMediaSpoiler: false },
    { name: "Major Spoiler", isMediaSpoiler: true },
  ],
  relations: {
    edges: [
      {
        relationType: "SEQUEL",
        node: {
          ...rawSummary,
          id: 16499,
          title: { romaji: "Season 2", english: null, native: null },
          type: "ANIME",
        },
      },
      {
        relationType: "ADAPTATION",
        node: {
          ...rawSummary,
          id: 30001,
          type: "MANGA",
          title: { romaji: "Manga", english: null, native: null },
        },
      },
    ],
  },
};

describe("mapAnimeSummary", () => {
  it("normalizes an AniList media node", () => {
    const anime = mapAnimeSummary(rawSummary);
    expect(anime).not.toBeNull();
    expect(anime).toMatchObject({
      id: 16498,
      title: {
        romaji: "Shingeki no Kyojin",
        english: "Attack on Titan",
        native: "進撃の巨人",
      },
      format: "TV",
      episodes: 25,
      averageScore: 84,
      seasonYear: 2013,
      status: "FINISHED",
    });
    expect(anime?.genres).toEqual(["Action", "Drama"]);
  });

  it("handles missing titles, images and genres", () => {
    const anime = mapAnimeSummary({
      id: 2,
      title: null,
      coverImage: null,
      format: null,
      episodes: null,
      averageScore: null,
      seasonYear: null,
      status: null,
    });

    expect(anime).not.toBeNull();
    expect(anime?.title).toEqual({ romaji: null, english: null, native: null });
    expect(anime?.coverImage).toEqual({
      extraLarge: null,
      large: null,
      color: null,
    });
    expect(anime?.genres).toEqual([]);
    expect(anime?.episodes).toBeNull();
  });

  it("rejects entries without a usable id", () => {
    expect(mapAnimeSummary({ ...rawSummary, id: "not-a-number" })).toBeNull();
    expect(mapAnimeSummary({ ...rawSummary, id: -1 })).toBeNull();
    expect(mapAnimeSummary(null)).toBeNull();
  });

  it("coerces unknown enum values and unsafe image urls to null", () => {
    const anime = mapAnimeSummary({
      ...rawSummary,
      format: "LIGHT_NOVEL",
      status: "UNKNOWN",
      averageScore: 140,
      coverImage: {
        extraLarge: "javascript:alert(1)",
        large: "not a url",
        color: null,
      },
    });

    expect(anime?.format).toBeNull();
    expect(anime?.status).toBeNull();
    expect(anime?.averageScore).toBeNull();
    expect(anime?.coverImage.extraLarge).toBeNull();
    expect(anime?.coverImage.large).toBeNull();
  });
});

describe("mapAnime", () => {
  it("maps details and strips HTML from the synopsis", () => {
    const anime = mapAnime(rawDetails);
    expect(anime).not.toBeNull();
    expect(anime?.synopsis).toContain("Humanity fights for survival.");
    expect(anime?.synopsis).toContain("Second paragraph & more.");
    expect(anime?.synopsis).not.toContain("<p>");
    expect(anime?.season).toBe("SPRING");
    expect(anime?.duration).toBe(24);
    expect(anime?.startDate).toEqual({ year: 2013, month: 4, day: 7 });
  });

  it("excludes spoiler tags and non-anime relations", () => {
    const anime = mapAnime(rawDetails);
    expect(anime?.tags).toEqual(["Military", "Tragedy"]);
    expect(anime?.relations).toHaveLength(1);
    expect(anime?.relations[0]).toMatchObject({
      id: 16499,
      relationType: "SEQUEL",
    });
  });

  it("returns null for unusable details", () => {
    expect(mapAnime({ id: "not-a-number", title: {} })).toBeNull();
    expect(mapAnime(null)).toBeNull();
  });
});

describe("mapAnimePage", () => {
  it("maps page info and items", () => {
    const page = mapAnimePage({
      pageInfo: {
        currentPage: 2,
        lastPage: 8,
        hasNextPage: true,
        total: 120,
      },
      media: [rawSummary],
    });

    expect(page.pageInfo).toEqual({
      currentPage: 2,
      lastPage: 8,
      hasNextPage: true,
      total: 120,
    });
    expect(page.items).toHaveLength(1);
  });

  it("defaults missing page info safely", () => {
    const page = mapAnimePage({ pageInfo: {}, media: [] }, 3);
    expect(page.pageInfo).toEqual({
      currentPage: 3,
      lastPage: null,
      hasNextPage: false,
      total: null,
    });
    expect(page.items).toEqual([]);
  });

  it("skips a malformed item but keeps the valid ones", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const page = mapAnimePage({
      pageInfo: { currentPage: 1 },
      media: [rawSummary, { id: "bad" }, null],
    });

    expect(page.items).toHaveLength(1);
    expect(page.items[0]?.id).toBe(16498);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("throws when every entry is malformed", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() =>
      mapAnimePage({ pageInfo: {}, media: [{ id: "a" }, null] }),
    ).toThrow(AniListError);
  });

  it("throws on an unexpected response shape", () => {
    expect(() => mapAnimePage({ items: [] })).toThrow(AniListError);
    expect(() => mapAnimePage(null)).toThrow(AniListError);
  });
});

describe("mapAnimeList", () => {
  it("skips malformed nodes and throws on non-lists", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(mapAnimeList([rawSummary, null, 42])).toHaveLength(1);
    expect(() => mapAnimeList({})).toThrow(AniListError);
  });
});
