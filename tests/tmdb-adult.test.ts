import { describe, expect, it } from "vitest";

import { applyAdultMode } from "@/lib/tmdb/adult";
import type { TmdbSearchPage, TmdbSearchResult } from "@/types/tmdb";

function result(tmdbId: number, adult?: boolean): TmdbSearchResult {
  return {
    tmdbId,
    kind: "movie",
    title: `Title ${tmdbId}`,
    originalTitle: null,
    overview: null,
    posterUrl: null,
    backdropUrl: null,
    releaseDate: "2020-01-01",
    year: 2020,
    voteAverage: 7,
    voteCount: 100,
    adult,
  };
}

const page: TmdbSearchPage = {
  page: 1,
  totalPages: 5,
  totalResults: 100,
  results: [result(1), result(2, true), result(3, false)],
};

describe("TMDB adult mode", () => {
  it("keeps normal results untouched when 18+ is hidden", () => {
    expect(applyAdultMode(page, undefined).results).toHaveLength(3);
    expect(applyAdultMode(page, "filtered").results).toHaveLength(3);
  });

  it("leaves both kinds mixed when 18+ is included", () => {
    expect(
      applyAdultMode(page, "include").results.map((item) => item.tmdbId),
    ).toEqual([1, 2, 3]);
  });

  it("returns only the flagged titles in 18+ only mode", () => {
    expect(
      applyAdultMode(page, "only").results.map((item) => item.tmdbId),
    ).toEqual([2]);
  });
});
