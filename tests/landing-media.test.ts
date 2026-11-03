import { describe, expect, it } from "vitest";

import {
  displayLandingTitle,
  selectLandingCover,
  splitMangaByOrigin,
} from "@/features/landing/landing-media";
import type { AnimeSummary } from "@/types/anime";

function media(overrides: Partial<AnimeSummary> = {}): AnimeSummary {
  return {
    id: 1,
    mediaType: "manga",
    title: { romaji: "Test Manga", english: null, native: null },
    coverImage: {
      extraLarge: "https://s4.anilist.co/file/anilistcdn/media/manga/xl.jpg",
      large: "https://s4.anilist.co/file/anilistcdn/media/manga/l.jpg",
      color: null,
    },
    format: "MANGA",
    episodes: null,
    chapters: 100,
    volumes: null,
    countryOfOrigin: "JP",
    isAdult: false,
    averageScore: 80,
    seasonYear: 2024,
    status: "FINISHED",
    genres: ["Drama"],
    ...overrides,
  };
}

describe("landing media helpers", () => {
  it("splits manga and manhwa by country of origin", () => {
    const { manga, manhwa } = splitMangaByOrigin([
      media({ id: 1, countryOfOrigin: "JP" }),
      media({ id: 2, countryOfOrigin: "KR" }),
      media({ id: 3, countryOfOrigin: "CN" }),
      media({ id: 4, countryOfOrigin: "JP" }),
      media({ id: 1, countryOfOrigin: "JP" }),
    ]);

    expect(manga.map((item) => item.id)).toEqual([1, 4]);
    expect(manhwa.map((item) => item.id)).toEqual([2]);
  });

  it("excludes anime and adult titles from the format collections", () => {
    const { manga, manhwa } = splitMangaByOrigin([
      media({ id: 1, countryOfOrigin: "JP" }),
      media({ id: 2, mediaType: "anime", countryOfOrigin: "JP" }),
      media({ id: 3, countryOfOrigin: "KR", isAdult: true }),
    ]);

    expect(manga.map((item) => item.id)).toEqual([1]);
    expect(manhwa).toEqual([]);
  });

  it("prefers extraLarge artwork and falls back safely", () => {
    expect(selectLandingCover(media())).toBe(
      "https://s4.anilist.co/file/anilistcdn/media/manga/xl.jpg",
    );

    expect(
      selectLandingCover(
        media({
          coverImage: {
            extraLarge: null,
            large: "https://s4.anilist.co/file/anilistcdn/media/manga/l.jpg",
            color: null,
          },
        }),
      ),
    ).toBe("https://s4.anilist.co/file/anilistcdn/media/manga/l.jpg");

    expect(
      selectLandingCover(
        media({
          coverImage: {
            extraLarge: "javascript:alert(1)",
            large: "not-a-url",
            color: null,
          },
        }),
      ),
    ).toBeNull();
  });

  it("uses a readable title fallback", () => {
    expect(
      displayLandingTitle(
        media({
          title: { romaji: null, english: null, native: "風の漫画" },
        }),
      ),
    ).toBe("風の漫画");
  });
});
