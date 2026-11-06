import { describe, expect, it } from "vitest";

import {
  adaptAniListDetailView,
  adaptTmdbDetailView,
} from "@/lib/media/detail-view";
import type { Anime, AnimeSummary } from "@/types/anime";
import type { TmdbDetails } from "@/types/tmdb";

const summary: AnimeSummary = {
  id: 1,
  title: {
    english: "Test Anime",
    romaji: "Tesuto Anime",
    native: null,
  },
  coverImage: {
    extraLarge: "https://example.com/cover.jpg",
    large: null,
    color: "#112233",
  },
  bannerImage: "https://example.com/banner.jpg",
  mediaType: "anime",
  format: "TV",
  episodes: 12,
  averageScore: 82,
  seasonYear: 2024,
  status: "RELEASING",
  genres: ["Action", "Drama"],
};

const anime: Anime = {
  ...summary,
  bannerImage: "https://example.com/banner.jpg",
  synopsis: "A test synopsis.",
  tags: ["Tag A"],
  season: "FALL",
  duration: 24,
  popularity: 12000,
  startDate: { year: 2024, month: 10, day: 1 },
  endDate: null,
  relations: [
    { ...summary, id: 2, relationType: "PREQUEL" },
    { ...summary, id: 3, relationType: "SEQUEL" },
  ],
  studios: [{ id: 1, name: "Test Studio" }],
  trailer: {
    id: "youtube-id",
    site: "youtube",
    thumbnail: "https://example.com/trailer.jpg",
  },
  recommendations: [],
};

const manga: Anime = {
  ...anime,
  id: 20,
  mediaType: "manga",
  format: "MANGA",
  episodes: null,
  chapters: 40,
  volumes: 5,
  season: null,
  duration: null,
  studios: [],
  relations: [],
};

function tmdbDetails(
  kind: "movie" | "tv",
  tmdbId: number,
): TmdbDetails {
  return {
    tmdbId,
    kind,
    title: kind === "movie" ? "Test Film" : "Test Series",
    originalTitle: "Original Title",
    overview: "A TMDB synopsis.",
    tagline: "A tagline.",
    posterUrl: "https://image.tmdb.org/t/p/w500/poster.jpg",
    backdropUrl: "https://image.tmdb.org/t/p/w1280/backdrop.jpg",
    releaseDate: "2024-03-01",
    year: 2024,
    genres: ["Drama"],
    runtime: kind === "movie" ? 120 : null,
    episodeRuntime: kind === "tv" ? [48] : [],
    numberOfSeasons: kind === "tv" ? 2 : null,
    numberOfEpisodes: kind === "tv" ? 16 : null,
    status: kind === "movie" ? "Released" : "Ended",
    voteAverage: 7.8,
    voteCount: 1200,
    adult: false,
    productionCompanies: kind === "movie" ? ["Test Studio"] : [],
    networks: kind === "tv" ? ["Test Network"] : [],
    cast: [
      {
        id: 1,
        name: "Test Actor",
        character: "Lead",
        profileUrl: null,
        order: 0,
      },
    ],
    crew: [
      {
        id: 2,
        name: "Test Director",
        job: "Director",
        department: "Directing",
        profileUrl: null,
      },
    ],
    recommendations: [],
    trailer: null,
    collection:
      kind === "movie"
        ? {
            id: 10,
            name: "Test Collection",
            posterUrl: null,
            backdropUrl: null,
            parts: [
              {
                tmdbId,
                title: "Test Film",
                posterUrl: null,
                releaseDate: "2024-03-01",
                year: 2024,
                overview: null,
              },
              {
                tmdbId: tmdbId + 1,
                title: "Test Film 2",
                posterUrl: null,
                releaseDate: "2025-03-01",
                year: 2025,
                overview: null,
              },
            ],
          }
        : null,
    seasons: [],
  };
}

describe("shared media detail view adapters", () => {
  it("adapts anime with its existing hero, franchise and facts", () => {
    const view = adaptAniListDetailView(anime);

    expect(view.kind).toBe("anime");
    expect(view.title).toBe("Test Anime");
    expect(view.secondaryTitle).toBe("Tesuto Anime");
    expect(view.mediaLabel).toBe("TV");
    expect(view.heroLinks?.previous?.href).toBe("/media/2");
    expect(view.heroLinks?.next?.href).toBe("/media/3");
    expect(view.facts).toContainEqual({ label: "Studio", value: "Test Studio" });
    expect(view.metrics).toContainEqual({
      label: "Community",
      value: "8.2",
      subvalue: "/ 10",
      star: true,
    });
  });

  it("adapts manga without inventing episode metadata", () => {
    const view = adaptAniListDetailView(manga);

    expect(view.kind).toBe("manga");
    expect(view.mediaLabel).toBe("Manga");
    expect(view.facts).toContainEqual({ label: "Chapters", value: "40" });
    expect(view.facts).toContainEqual({ label: "Volumes", value: "5" });
    expect(view.facts.some((fact) => fact.label === "Episodes")).toBe(false);
    expect(view.heroLinks).toBeNull();
  });

  it("adapts a TMDB movie with collection navigation and credits", () => {
    const view = adaptTmdbDetailView(tmdbDetails("movie", 42));

    expect(view.kind).toBe("movie");
    expect(view.mediaLabel).toBe("Film");
    expect(view.title).toBe("Test Film");
    expect(view.heroLinks?.label).toBe("Test Collection");
    expect(view.heroLinks?.next?.href).toBe("/screen/movie/43");
    expect(view.facts).toContainEqual({
      label: "Production",
      value: "Test Studio",
    });
    expect(view.metrics[0]).toMatchObject({ label: "TMDB", value: "7.8" });
  });

  it("adapts a TMDB TV show with season metadata and network facts", () => {
    const view = adaptTmdbDetailView(tmdbDetails("tv", 99));

    expect(view.kind).toBe("tv");
    expect(view.mediaLabel).toBe("TV");
    expect(view.metaLine).toContain("2 seasons");
    expect(view.metaLine).toContain("16 episodes");
    expect(view.facts).toContainEqual({
      label: "Network",
      value: "Test Network",
    });
    expect(view.heroLinks).toBeNull();
  });
});
