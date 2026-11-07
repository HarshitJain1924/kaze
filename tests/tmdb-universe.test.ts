import { describe, expect, it } from "vitest";

import {
  TMDB_UNIVERSES,
  buildTmdbUniverse,
  isListableUniverseEntry,
  matchTmdbUniverse,
  universePositionLabel,
  universeUnitLabel,
} from "@/lib/tmdb/universes";
import type { TmdbUniverseEntry } from "@/types/tmdb";

const mcu = TMDB_UNIVERSES.find((universe) => universe.id === "mcu")!;

function entry(
  tmdbId: number,
  title: string,
  releaseDate: string | null,
): TmdbUniverseEntry {
  return {
    tmdbId,
    title,
    posterUrl: null,
    releaseDate,
    year: releaseDate ? Number(releaseDate.slice(0, 4)) : null,
    voteAverage: 7.5,
  };
}

const roster = {
  total: 4,
  entries: [
    entry(1726, "Iron Man", "2008-04-30"),
    entry(1724, "The Incredible Hulk", "2008-06-12"),
    entry(10138, "Iron Man 2", "2010-04-28"),
    entry(24428, "The Avengers", "2012-04-25"),
  ],
};

describe("TMDB universes", () => {
  it("matches a title through its universe keyword", () => {
    expect(matchTmdbUniverse("movie", [180547])?.id).toBe("mcu");
    expect(matchTmdbUniverse("movie", [229266])?.id).toBe("dceu");
    expect(matchTmdbUniverse("movie", [380322])?.id).toBe("monsterverse");
  });

  it("ignores titles without a universe keyword and other media kinds", () => {
    expect(matchTmdbUniverse("movie", [])).toBeNull();
    expect(matchTmdbUniverse("movie", [999, 1234])).toBeNull();
    expect(matchTmdbUniverse("tv", [229266])).toBeNull();
  });

  it("reports the release-order position of the current title", () => {
    const universe = buildTmdbUniverse(mcu, roster, 24428);
    expect(universe.position).toBe(4);
    expect(universe.total).toBe(4);
    expect(universe.entries.map((item) => item.title)).toEqual([
      "Iron Man",
      "The Incredible Hulk",
      "Iron Man 2",
      "The Avengers",
    ]);
    expect(universePositionLabel(universe.position!, universe.total)).toBe(
      "#4 of 4",
    );
  });

  it("keeps the roster usable when the current title is not listed", () => {
    const universe = buildTmdbUniverse(mcu, roster, 999999);
    expect(universe.position).toBeNull();
    expect(universe.entries).toHaveLength(4);
  });

  it("drops making-of specials and unreleased or undated titles", () => {
    const today = "2026-11-07";
    expect(
      isListableUniverseEntry(entry(1, "Iron Man", "2008-04-30"), mcu, today),
    ).toBe(true);
    expect(
      isListableUniverseEntry(
        entry(2, "Marvel Studios Assembled: The Making of Echo", "2024-01-31"),
        mcu,
        today,
      ),
    ).toBe(false);
    expect(
      isListableUniverseEntry(entry(3, "Avengers: Doomsday", "2026-12-16"), mcu, today),
    ).toBe(false);
    expect(
      isListableUniverseEntry(entry(4, "Nova", null), mcu, today),
    ).toBe(false);
  });

  it("labels the unit for each media kind", () => {
    expect(universeUnitLabel("movie", 1)).toBe("title");
    expect(universeUnitLabel("movie", 56)).toBe("titles");
    expect(universeUnitLabel("tv", 12)).toBe("series");
  });
});
