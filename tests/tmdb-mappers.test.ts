import { describe, expect, it } from "vitest";

import {
  mapDetails,
  mapSearchPage,
  mapSeason,
} from "@/services/tmdb/mappers";
import { TmdbValidationError } from "@/services/tmdb/errors";

describe("TMDB mappers", () => {
  it("maps movie search results and tolerates missing optional fields", () => {
    const page = mapSearchPage("movie", {
      page: 1,
      total_pages: 2,
      total_results: 21,
      results: [
        {
          id: 603,
          title: "The Matrix",
          original_title: "The Matrix",
          overview: "A hacker learns the truth.",
          poster_path: "/poster.jpg",
          backdrop_path: null,
          release_date: "1999-03-31",
          vote_average: 8.2,
          vote_count: 25000,
        },
        {
          id: 604,
          title: "Missing Artwork",
          poster_path: null,
          release_date: "",
          vote_average: 0,
        },
      ],
    });

    expect(page.totalPages).toBe(2);
    expect(page.results[0]).toMatchObject({
      tmdbId: 603,
      kind: "movie",
      title: "The Matrix",
      year: 1999,
      posterUrl: "https://image.tmdb.org/t/p/w500/poster.jpg",
      backdropUrl: null,
    });
    expect(page.results[1]).toMatchObject({
      tmdbId: 604,
      posterUrl: null,
      year: null,
      voteAverage: 0,
    });
  });

  it("maps TV search using name and first air date", () => {
    const page = mapSearchPage("tv", {
      page: 1,
      total_pages: 1,
      total_results: 1,
      results: [
        {
          id: 1396,
          name: "Breaking Bad",
          original_name: "Breaking Bad",
          first_air_date: "2008-01-20",
          poster_path: "/bb.jpg",
          vote_average: 8.9,
        },
      ],
    });

    expect(page.results[0]).toMatchObject({
      kind: "tv",
      title: "Breaking Bad",
      year: 2008,
    });
  });

  it("maps movie details with runtime and genres", () => {
    const details = mapDetails("movie", {
      id: 603,
      title: "The Matrix",
      original_title: "The Matrix",
      overview: "A hacker learns the truth.",
      tagline: "Welcome to the real world.",
      poster_path: "/p.jpg",
      backdrop_path: "/b.jpg",
      release_date: "1999-03-31",
      runtime: 136,
      status: "Released",
      genres: [{ id: 28, name: "Action" }],
      vote_average: 8.2,
      vote_count: 25000,
    });

    expect(details).toMatchObject({
      tmdbId: 603,
      kind: "movie",
      title: "The Matrix",
      runtime: 136,
      genres: ["Action"],
      year: 1999,
      numberOfSeasons: null,
    });
  });

  it("maps TV details with seasons and episode runtime", () => {
    const details = mapDetails("tv", {
      id: 1396,
      name: "Breaking Bad",
      first_air_date: "2008-01-20",
      episode_run_time: [47],
      number_of_seasons: 5,
      number_of_episodes: 62,
      status: "Ended",
      genres: [{ id: 18, name: "Drama" }],
      seasons: [
        {
          season_number: 0,
          name: "Specials",
          episode_count: 2,
        },
        {
          season_number: 1,
          name: "Season 1",
          episode_count: 7,
          air_date: "2008-01-20",
          poster_path: "/s1.jpg",
        },
      ],
    });

    expect(details.kind).toBe("tv");
    expect(details.title).toBe("Breaking Bad");
    expect(details.seasons).toHaveLength(2);
    expect(details.seasons[1]).toMatchObject({
      seasonNumber: 1,
      episodeCount: 7,
      posterUrl: "https://image.tmdb.org/t/p/w342/s1.jpg",
    });
  });

  it("maps a season payload into explicit episodes", () => {
    const season = mapSeason(1396, {
      season_number: 1,
      name: "Season 1",
      episodes: [
        {
          episode_number: 1,
          name: "Pilot",
          air_date: "2008-01-20",
          runtime: 58,
          still_path: "/still.jpg",
        },
        {
          episode_number: 2,
          name: "Cat's in the Bag...",
          runtime: 48,
        },
      ],
    });

    expect(season.episodes).toHaveLength(2);
    expect(season.episodes[0]).toMatchObject({
      seasonNumber: 1,
      episodeNumber: 1,
      name: "Pilot",
      runtime: 58,
      stillUrl: "https://image.tmdb.org/t/p/w300/still.jpg",
    });
  });

  it("rejects malformed provider payloads instead of inventing data", () => {
    expect(() => mapSearchPage("movie", { results: "nope" })).toThrow(
      TmdbValidationError,
    );
    expect(() => mapDetails("movie", { id: "not-a-number" })).toThrow(
      TmdbValidationError,
    );
  });
});
