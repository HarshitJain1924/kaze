import { describe, expect, it } from "vitest";

import {
  adaptAniListDetails,
  adaptAniListSummary,
  normalizeMediaArtwork,
} from "@/lib/media/adapters";
import type { Anime, AnimeSummary } from "@/types/anime";
import { toCanonicalMediaId, type CanonicalMediaId } from "@/types/media";

function makeSummary(
  id: number,
  overrides: Partial<AnimeSummary> = {},
): AnimeSummary {
  return {
    id,
    title: {
      english: `Anime ${id}`,
      romaji: `Anime ${id}`,
      native: null,
    },
    coverImage: {
      extraLarge: `https://example.com/cover-${id}.jpg`,
      large: null,
      color: null,
    },
    format: "TV",
    episodes: 12,
    averageScore: 80,
    seasonYear: 2024,
    status: "FINISHED",
    genres: ["Action"],
    ...overrides,
  };
}

function makeAnime(id: number, overrides: Partial<Anime> = {}): Anime {
  return {
    ...makeSummary(id),
    bannerImage: null,
    synopsis: "A synopsis.",
    tags: [],
    season: "FALL",
    duration: 24,
    popularity: 1000,
    startDate: { year: 2024, month: 10, day: 1 },
    endDate: null,
    relations: [],
    ...overrides,
  };
}

const MEDIA_ID = "123e4567-e89b-42d3-a456-426614174000";

function mediaId(value: string = MEDIA_ID): CanonicalMediaId {
  const id = toCanonicalMediaId(value);
  if (!id) throw new Error(`Invalid test media id: ${value}`);
  return id;
}

describe("adaptAniListSummary", () => {
  it("maps an anime summary without mutating the AniList model", () => {
    const summary = makeSummary(16498, {
      bannerImage: "https://s4.anilist.co/file/banner.jpg",
      title: {
        romaji: "Shingeki no Kyojin",
        english: "Attack on Titan",
        native: "進撃の巨人",
      },
    });

    const media = adaptAniListSummary(summary, { mediaId: mediaId() });

    expect(media.kind).toBe("anime");
    expect(media.id).toBe(MEDIA_ID);
    expect(media.title.primary).toBe("Attack on Titan");
    expect(media.releaseYear).toBe(2024);
    expect(media.communityRating).toMatchObject({
      score: 80,
      scale: 100,
      provider: "anilist",
    });
    expect(media.providerRefs).toEqual([
      {
        provider: "anilist",
        externalId: "16498",
        sourceUrl: "https://anilist.co/anime/16498",
      },
    ]);
    expect(media.artwork.map((art) => art.role)).toEqual([
      "poster",
      "banner",
    ]);
    expect(media.artwork[0]).toMatchObject({
      role: "poster",
      url: "https://example.com/cover-16498.jpg",
      provider: "anilist",
      isPrimary: true,
    });

    if (media.kind !== "anime") throw new Error("expected anime");
    expect(media.episodes).toBe(12);
    expect(summary.title.english).toBe("Attack on Titan");
  });

  it("maps manga without forcing chapter fields onto anime", () => {
    const summary = makeSummary(105398, {
      mediaType: "manga",
      format: "MANGA",
      chapters: 120,
      volumes: 12,
      countryOfOrigin: "KR",
      episodes: null,
    });

    const media = adaptAniListSummary(summary, { mediaId: mediaId() });

    expect(media.kind).toBe("manga");
    if (media.kind !== "manga") throw new Error("expected manga");
    expect(media.chapters).toBe(120);
    expect(media.volumes).toBe(12);
    expect(media.countryOfOrigin).toBe("KR");
    expect(media.providerRefs[0]?.sourceUrl).toContain("/manga/105398");
  });

  it.each(["MANGA", "ONE_SHOT"] as const)(
    "detects manga from %s when mediaType is absent",
    (format) => {
      const media = adaptAniListSummary(
        makeSummary(105398, {
          format,
          chapters: 20,
          volumes: 2,
        }),
        { mediaId: mediaId() },
      );

      expect(media.kind).toBe("manga");
      if (media.kind !== "manga") throw new Error("expected manga");
      expect(media.chapters).toBe(20);
      expect(media.volumes).toBe(2);
      expect(media.providerRefs[0]?.sourceUrl).toContain("/manga/105398");
    },
  );

  it("keeps an explicit anime type authoritative over a manga-like format", () => {
    const media = adaptAniListSummary(
      makeSummary(1, { mediaType: "anime", format: "MANGA" }),
      { mediaId: mediaId() },
    );

    expect(media.kind).toBe("anime");
    expect(media.providerRefs[0]?.sourceUrl).toContain("/anime/1");
  });

  it.each(["TV", "TV_SHORT", "OVA", "ONA", "SPECIAL", "MUSIC"] as const)(
    "keeps AniList %s entries in the anime kind",
    (format) => {
      const media = adaptAniListSummary(
        makeSummary(1, { mediaType: "anime", format }),
        { mediaId: mediaId() },
      );

      expect(media.kind).toBe("anime");
    },
  );

  it("classifies AniList MOVIE entries as movies", () => {
    const media = adaptAniListSummary(
      makeSummary(10, { mediaType: "anime", format: "MOVIE" }),
      { mediaId: mediaId() },
    );

    expect(media.kind).toBe("movie");
    if (media.kind !== "movie") throw new Error("expected movie");
    expect(media.runtimeMinutes).toBeNull();
    expect(media.providerRefs[0]?.sourceUrl).toContain("/anime/10");
  });

  it("falls back to a safe large poster when extraLarge is unsafe", () => {
    const media = adaptAniListSummary(
      makeSummary(1, {
        coverImage: {
          extraLarge: "javascript:alert(1)",
          large: "https://example.com/safe-large.jpg",
          color: null,
        },
      }),
      { mediaId: mediaId() },
    );

    expect(media.artwork).toHaveLength(1);
    expect(media.artwork[0]).toMatchObject({
      role: "poster",
      url: "https://example.com/safe-large.jpg",
    });
  });

  it("omits unsafe or missing artwork and invalid scores", () => {
    const summary = makeSummary(1, {
      coverImage: {
        extraLarge: "javascript:alert(1)",
        large: null,
        color: null,
      },
      bannerImage: "not a url",
      averageScore: 140,
    });

    const media = adaptAniListSummary(summary, { mediaId: mediaId() });

    expect(media.artwork).toEqual([]);
    expect(media.communityRating).toBeNull();
  });

  it.each([
    [0, 0],
    [100, 100],
    [-1, null],
    [Number.NaN, null],
    [Number.POSITIVE_INFINITY, null],
    [null, null],
  ] as const)("handles the community score boundary %s", (score, expected) => {
    const media = adaptAniListSummary(
      makeSummary(1, { averageScore: score }),
      { mediaId: mediaId() },
    );

    expect(media.communityRating?.score ?? null).toBe(expected);
  });

  it("normalizes missing titles to a generic display title", () => {
    const summary = makeSummary(2, {
      title: { romaji: null, english: null, native: null },
    });

    const media = adaptAniListSummary(summary, { mediaId: mediaId() });

    expect(media.title.primary).toBe("Untitled media");
  });

  it("rejects a provider ID passed as a canonical ID at runtime", () => {
    expect(() =>
      adaptAniListSummary(makeSummary(1), {
        mediaId: "16498" as CanonicalMediaId,
      }),
    ).toThrow(TypeError);
  });
});

describe("normalizeMediaArtwork", () => {
  it("accepts missing optional metadata and preserves valid geometry", () => {
    const artwork = normalizeMediaArtwork({
      role: "poster",
      url: "https://example.com/poster.jpg",
      provider: "anilist",
      width: 1000,
      height: 1500,
      aspectRatio: 2 / 3,
      focalPoint: { x: 0.5, y: 0.4 },
      language: "en",
      attribution: "AniList",
    });

    expect(artwork).toMatchObject({
      role: "poster",
      url: "https://example.com/poster.jpg",
      width: 1000,
      height: 1500,
      aspectRatio: 2 / 3,
      focalPoint: { x: 0.5, y: 0.4 },
      language: "en",
      attribution: "AniList",
      isPrimary: false,
    });

    expect(
      normalizeMediaArtwork({
        role: "banner",
        url: "https://example.com/banner.jpg",
        provider: "anilist",
      }),
    ).toMatchObject({
      width: null,
      height: null,
      aspectRatio: null,
      focalPoint: null,
      language: null,
      attribution: null,
    });
  });

  it("rejects unsafe URLs and malformed provided geometry", () => {
    expect(
      normalizeMediaArtwork({
        role: "poster",
        url: "javascript:alert(1)",
        provider: "anilist",
      }),
    ).toBeNull();

    expect(
      normalizeMediaArtwork({
        role: "poster",
        url: "https://example.com/poster.jpg",
        provider: "anilist",
        width: 0,
      }),
    ).toBeNull();

    expect(
      normalizeMediaArtwork({
        role: "poster",
        url: "https://example.com/poster.jpg",
        provider: "anilist",
        aspectRatio: -1,
      }),
    ).toBeNull();

    expect(
      normalizeMediaArtwork({
        role: "poster",
        url: "https://example.com/poster.jpg",
        provider: "anilist",
        focalPoint: { x: 1.1, y: 0.5 },
      }),
    ).toBeNull();

    expect(
      normalizeMediaArtwork({
        role: "poster",
        url: "https://example.com/landscape.jpg",
        provider: "anilist",
        width: 1600,
        height: 900,
      }),
    ).toBeNull();

    expect(
      normalizeMediaArtwork({
        role: "banner",
        url: "https://example.com/portrait.jpg",
        provider: "anilist",
        aspectRatio: 2 / 3,
      }),
    ).toBeNull();
  });
});

describe("adaptAniListDetails", () => {
  it("maps anime-specific details while preserving the summary fields", () => {
    const anime = makeAnime(16498, {
      bannerImage: "https://s4.anilist.co/file/banner.jpg",
      studios: [{ id: 10, name: "Wit Studio", isMain: true }],
      season: "SPRING",
      duration: 24,
      startDate: { year: 2013, month: 4, day: 7 },
      endDate: { year: 2013, month: 9, day: 29 },
    });

    const details = adaptAniListDetails(anime, { mediaId: mediaId() });

    expect(details.kind).toBe("anime");
    if (details.kind !== "anime") throw new Error("expected anime details");
    expect(details.synopsis).toBe("A synopsis.");
    expect(details.studios).toEqual(["Wit Studio"]);
    expect(details.durationMinutes).toBe(24);
    expect(details.season).toBe("SPRING");
    expect(details.startDate).toEqual({
      year: 2013,
      month: 4,
      day: 7,
    });
    expect(details.characters).toEqual([]);
    expect(details.externalLinks).toEqual([]);
    expect(details.themes).toEqual([]);
    expect(details.legacyAnimeDetails).toEqual({
      recommendations: [],
      relations: [],
    });
  });

  it("preserves all existing anime detail surfaces", () => {
    const recommendation = makeSummary(200);
    const relation = {
      ...makeSummary(201),
      relationType: "SEQUEL",
    };
    const anime = makeAnime(16498, {
      characters: [
        {
          id: 1,
          name: { full: "Eren Yeager", native: "エレン・イェーガー" },
          image: "https://example.com/eren.jpg",
          role: "MAIN",
          voiceActor: {
            id: 2,
            name: { full: "Yuki Kaji", native: "梶裕貴" },
            image: "https://example.com/yuki.jpg",
            language: "Japanese",
          },
        },
      ],
      trailer: {
        id: "trailer-id",
        site: "youtube",
        thumbnail: "https://example.com/trailer.jpg",
      },
      recommendations: [recommendation],
      externalLinks: [
        {
          id: 3,
          url: "https://www.crunchyroll.com/",
          site: "Crunchyroll",
          type: "STREAMING",
          icon: "https://example.com/crunchyroll.png",
          color: "#f47521",
        },
      ],
      tags: ["Shounen", "Tragedy"],
      themes: [
        {
          id: "theme-1",
          slug: "OP1",
          type: "OP",
          title: "Guren no Yumiya",
          artist: "Linked Horizon",
          episodes: "1-13",
          videoUrl: "https://example.com/op.mp4",
          audioUrl: null,
        },
      ],
      popularity: 450000,
      relations: [relation],
    });

    const details = adaptAniListDetails(anime, { mediaId: mediaId() });

    if (details.kind !== "anime") throw new Error("expected anime details");
    expect(details.characters).toMatchObject([
      {
        id: 1,
        name: "Eren Yeager",
        nativeName: "エレン・イェーガー",
        imageUrl: "https://example.com/eren.jpg",
        role: "MAIN",
        voiceActor: {
          name: "Yuki Kaji",
          nativeName: "梶裕貴",
          imageUrl: "https://example.com/yuki.jpg",
          language: "Japanese",
        },
      },
    ]);
    expect(details.trailer).toEqual({
      id: "trailer-id",
      site: "youtube",
      thumbnailUrl: "https://example.com/trailer.jpg",
    });
    expect(details.externalLinks).toEqual([
      {
        id: 3,
        url: "https://www.crunchyroll.com/",
        site: "Crunchyroll",
        type: "STREAMING",
        iconUrl: "https://example.com/crunchyroll.png",
        color: "#f47521",
      },
    ]);
    expect(details.tags).toEqual(["Shounen", "Tragedy"]);
    expect(details.themes).toEqual([
      {
        id: "theme-1",
        slug: "OP1",
        type: "OP",
        title: "Guren no Yumiya",
        artist: "Linked Horizon",
        episodes: "1-13",
        videoUrl: "https://example.com/op.mp4",
        audioUrl: null,
      },
    ]);
    expect(details.popularity).toBe(450000);
    expect(details.legacyAnimeDetails.recommendations[0]?.id).toBe(200);
    expect(details.legacyAnimeDetails.relations[0]).toMatchObject({
      id: 201,
      relationType: "SEQUEL",
    });
  });

  it("maps manga details and keeps unavailable author data explicit", () => {
    const manga = makeAnime(30001, {
      mediaType: "manga",
      format: "MANGA",
      chapters: 340,
      volumes: 34,
      countryOfOrigin: "JP",
      status: "FINISHED",
      studios: [],
      duration: null,
      season: null,
      startDate: { year: 1999, month: null, day: null },
      endDate: null,
    });

    const details = adaptAniListDetails(manga, { mediaId: mediaId() });

    expect(details.kind).toBe("manga");
    if (details.kind !== "manga") throw new Error("expected manga details");
    expect(details.chapters).toBe(340);
    expect(details.volumes).toBe(34);
    expect(details.authors).toEqual([]);
    expect(details.artists).toEqual([]);
    expect(details.publicationStatus).toBe("FINISHED");
    expect(details.readingFormat).toBe("MANGA");
    expect(details.startDate).toEqual({
      year: 1999,
      month: null,
      day: null,
    });
  });

  it("maps AniList movie details without inventing provider metadata", () => {
    const movie = makeAnime(10, {
      mediaType: "anime",
      format: "MOVIE",
      episodes: 1,
      duration: 106,
      tags: ["Anime"],
      popularity: 2500,
      startDate: { year: 2024, month: 6, day: 14 },
      endDate: null,
    });

    const details = adaptAniListDetails(movie, { mediaId: mediaId() });

    expect(details.kind).toBe("movie");
    if (details.kind !== "movie") throw new Error("expected movie details");
    expect(details.runtimeMinutes).toBe(106);
    expect(details.releaseDate).toEqual({
      year: 2024,
      month: 6,
      day: 14,
    });
    expect(details.productionCompanies).toEqual([]);
    expect(details.cast).toEqual([]);
    expect(details.crew).toEqual([]);
    expect(details.tags).toEqual(["Anime"]);
  });
});
