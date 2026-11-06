import { describe, expect, it } from "vitest";

import { mapCollection, mapDetails } from "@/services/tmdb/mappers";

describe("TMDB detail enrichment", () => {
  it("maps cast, crew, recommendations, trailers and collection references", () => {
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
      production_companies: [{ id: 1, name: "Village Roadshow" }],
      credits: {
        cast: [
          {
            id: 6384,
            name: "Keanu Reeves",
            character: "Neo",
            profile_path: "/keanu.jpg",
            order: 0,
          },
        ],
        crew: [
          {
            id: 9330,
            name: "Lana Wachowski",
            job: "Director",
            department: "Directing",
            profile_path: null,
          },
        ],
      },
      recommendations: {
        results: [
          {
            id: 604,
            title: "The Matrix Reloaded",
            poster_path: "/reloaded.jpg",
            release_date: "2003-05-15",
            vote_average: 7.2,
          },
        ],
      },
      videos: {
        results: [
          {
            id: "video-1",
            key: "trailer-key",
            name: "Official Trailer",
            site: "YouTube",
            type: "Trailer",
          },
        ],
      },
      belongs_to_collection: {
        id: 2344,
        name: "The Matrix Collection",
        poster_path: "/collection.jpg",
        backdrop_path: "/collection-backdrop.jpg",
      },
    });

    expect(details.cast[0]).toMatchObject({
      name: "Keanu Reeves",
      character: "Neo",
      profileUrl: "https://image.tmdb.org/t/p/w185/keanu.jpg",
    });
    expect(details.crew).toContainEqual(
      expect.objectContaining({
        name: "Lana Wachowski",
        job: "Director",
      }),
    );
    expect(details.recommendations[0]).toMatchObject({
      tmdbId: 604,
      kind: "movie",
      title: "The Matrix Reloaded",
    });
    expect(details.trailer).toMatchObject({
      key: "trailer-key",
      site: "YouTube",
      type: "Trailer",
    });
    expect(details.collection).toMatchObject({
      id: 2344,
      name: "The Matrix Collection",
      parts: [],
    });
    expect(details.productionCompanies).toEqual(["Village Roadshow"]);
  });

  it("maps collection parts into navigation data", () => {
    const collection = mapCollection({
      id: 2344,
      name: "The Matrix Collection",
      poster_path: "/collection.jpg",
      parts: [
        {
          id: 603,
          title: "The Matrix",
          release_date: "1999-03-31",
          poster_path: "/matrix.jpg",
        },
        {
          id: 604,
          title: "The Matrix Reloaded",
          release_date: "2003-05-15",
        },
      ],
    });

    expect(collection.parts).toHaveLength(2);
    expect(collection.parts[0]).toMatchObject({
      tmdbId: 603,
      year: 1999,
      posterUrl: "https://image.tmdb.org/t/p/w342/matrix.jpg",
    });
  });

  it("defaults missing credits and collections without inventing data", () => {
    const details = mapDetails("tv", {
      id: 1396,
      name: "Breaking Bad",
      first_air_date: "2008-01-20",
      genres: [],
    });

    expect(details.cast).toEqual([]);
    expect(details.crew).toEqual([]);
    expect(details.recommendations).toEqual([]);
    expect(details.trailer).toBeNull();
    expect(details.collection).toBeNull();
  });
});
