import { describe, expect, it } from "vitest";

import {
  animeSearchParamsSchema,
  parseAnimeSearchParams,
  serializeAnimeSearchParams,
} from "@/lib/validation/anime";
import {
  addToLibrarySchema,
  entryPatchSchema,
  entryUpdateRequestSchema,
  progressSchema,
  scoreSchema,
} from "@/lib/validation/library";

describe("animeSearchParamsSchema", () => {
  it("treats blank filters as absent", () => {
    const result = animeSearchParamsSchema.parse({
      query: "   ",
      genre: "",
      format: "",
      season: "",
      seasonYear: "",
      sort: "",
      page: "",
      perPage: "",
    });

    expect(result.query).toBeUndefined();
    expect(result.genre).toBeUndefined();
    expect(result.format).toBeUndefined();
    expect(result.season).toBeUndefined();
    expect(result.seasonYear).toBeUndefined();
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(24);
  });

  it("coerces year and paging values", () => {
    const result = animeSearchParamsSchema.parse({
      query: "  Cowboy Bebop ",
      genre: "Sci-Fi",
      format: "TV",
      season: "SPRING",
      seasonYear: "1998",
      sort: "SCORE_DESC",
      page: "2",
      perPage: "12",
    });

    expect(result).toEqual({
      query: "Cowboy Bebop",
      genre: "Sci-Fi",
      format: "TV",
      season: "SPRING",
      seasonYear: 1998,
      sort: "SCORE_DESC",
      page: 2,
      perPage: 12,
    });
  });

  it("rejects unsupported enums and unsafe ranges", () => {
    expect(
      animeSearchParamsSchema.safeParse({ format: "LIGHT_NOVEL" }).success,
    ).toBe(false);
    expect(
      animeSearchParamsSchema.safeParse({ sort: "RANDOM" }).success,
    ).toBe(false);
    expect(
      animeSearchParamsSchema.safeParse({ seasonYear: 1800 }).success,
    ).toBe(false);
    expect(animeSearchParamsSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(
      animeSearchParamsSchema.safeParse({ perPage: 500 }).success,
    ).toBe(false);
  });

  it("round-trips the extended discover filters", () => {
    const result = animeSearchParamsSchema.parse({
      status: "RELEASING",
      source: "LIGHT_NOVEL",
      countryOfOrigin: "JP",
      adult: "only",
      sort: "FAVOURITES_DESC",
    });

    expect(result.status).toBe("RELEASING");
    expect(result.source).toBe("LIGHT_NOVEL");
    expect(result.countryOfOrigin).toBe("JP");
    expect(result.adult).toBe("only");
    expect(result.sort).toBe("FAVOURITES_DESC");

    const serialized = serializeAnimeSearchParams(result);
    expect(serialized.get("status")).toBe("RELEASING");
    expect(serialized.get("source")).toBe("LIGHT_NOVEL");
    expect(serialized.get("country")).toBe("JP");
    expect(serialized.get("adult")).toBe("only");
    expect(serialized.get("sort")).toBe("FAVOURITES_DESC");

    // The client reads the same keys back from the URL.
    const parsed = parseAnimeSearchParams(serialized);
    expect(parsed.status).toBe("RELEASING");
    expect(parsed.source).toBe("LIGHT_NOVEL");
    expect(parsed.countryOfOrigin).toBe("JP");
    expect(parsed.adult).toBe("only");

    // No adult selection means filtered, which is never written to the URL.
    const filtered = animeSearchParamsSchema.parse({});
    expect(filtered.adult).toBeUndefined();
    expect(serializeAnimeSearchParams(filtered).has("adult")).toBe(false);
  });

  it("parses URLSearchParams and serializes non-default filters", () => {
    const input = parseAnimeSearchParams(
      new URLSearchParams("q=bebop&genre=Action&year=1998&page=3"),
    );
    expect(input.query).toBe("bebop");
    expect(input.seasonYear).toBe(1998);
    expect(input.page).toBe(3);

    const serialized = serializeAnimeSearchParams(input, {
      includePaging: true,
    });
    expect(serialized.toString()).toContain("q=bebop");
    expect(serialized.toString()).toContain("genre=Action");
    expect(serialized.toString()).toContain("year=1998");
    expect(serialized.toString()).toContain("page=3");
    expect(serialized.toString()).not.toContain("perPage=24");
  });
});

describe("library input schemas", () => {
  it("requires positive integer AniList ids", () => {
    expect(
      addToLibrarySchema.safeParse({ anilistId: 0 }).success,
    ).toBe(false);
    expect(
      addToLibrarySchema.safeParse({ anilistId: 1.5 }).success,
    ).toBe(false);
    expect(addToLibrarySchema.parse({ anilistId: 12 }).status).toBe("planning");
  });

  it("rejects invalid statuses and empty updates", () => {
    expect(
      entryPatchSchema.safeParse({ status: "rewatching" }).success,
    ).toBe(false);
    expect(entryPatchSchema.safeParse({}).success).toBe(false);
  });

  it("validates progress bounds", () => {
    expect(progressSchema.safeParse(0).success).toBe(true);
    expect(progressSchema.safeParse(12).success).toBe(true);
    expect(progressSchema.safeParse(-1).success).toBe(false);
    expect(progressSchema.safeParse(1.2).success).toBe(false);
    expect(progressSchema.safeParse(200_000).success).toBe(false);
  });

  it("validates personal ratings on a 1–10 scale", () => {
    expect(scoreSchema.safeParse(1).success).toBe(true);
    expect(scoreSchema.safeParse(10).success).toBe(true);
    expect(scoreSchema.safeParse(null).success).toBe(true);
    expect(scoreSchema.safeParse(0).success).toBe(false);
    expect(scoreSchema.safeParse(11).success).toBe(false);
    expect(scoreSchema.safeParse(7.5).success).toBe(false);
  });

  it("trims notes and converts blank notes to null", () => {
    const parsed = entryPatchSchema.parse({ notes: "  Great finale  " });
    expect(parsed.notes).toBe("Great finale");

    const blank = entryPatchSchema.parse({ notes: "   " });
    expect(blank.notes).toBeNull();
  });

  it("rejects notes longer than the limit", () => {
    expect(
      entryPatchSchema.safeParse({ notes: "x".repeat(5001) }).success,
    ).toBe(false);
  });

  it("accepts a client-provided episode total alongside a real change", () => {
    const parsed = entryUpdateRequestSchema.parse({
      status: "completed",
      totalEpisodes: 12,
    });

    expect(parsed.totalEpisodes).toBe(12);
    expect(parsed.status).toBe("completed");

    // A total alone is not a library change.
    expect(
      entryUpdateRequestSchema.safeParse({ totalEpisodes: 12 }).success,
    ).toBe(false);
  });
});
