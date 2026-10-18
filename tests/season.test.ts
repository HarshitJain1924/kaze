import { describe, expect, it } from "vitest";

import { getCurrentSeason, getSeasonForDate, seasonLabel } from "@/lib/season";

function utcDate(year: number, month: number, day = 1) {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

describe("getSeasonForDate", () => {
  it.each([
    [1, 1, "WINTER"],
    [3, 31, "WINTER"],
    [4, 1, "SPRING"],
    [6, 30, "SPRING"],
    [7, 1, "SUMMER"],
    [9, 30, "SUMMER"],
    [10, 1, "FALL"],
    [12, 31, "FALL"],
  ] as const)("maps %i/%i to %s", (month, day, season) => {
    expect(getSeasonForDate(utcDate(2026, month, day))).toEqual({
      season,
      year: 2026,
    });
  });

  it("uses the UTC year around New Year", () => {
    const newYear = new Date("2027-01-01T00:30:00.000Z");
    expect(getSeasonForDate(newYear)).toEqual({ season: "WINTER", year: 2027 });
  });

  it("returns the season for the current date by default", () => {
    const now = new Date("2026-10-18T12:00:00.000Z");
    expect(getCurrentSeason(now)).toEqual({ season: "FALL", year: 2026 });
  });
});

describe("seasonLabel", () => {
  it("labels every season", () => {
    expect(seasonLabel("WINTER")).toBe("Winter");
    expect(seasonLabel("SPRING")).toBe("Spring");
    expect(seasonLabel("SUMMER")).toBe("Summer");
    expect(seasonLabel("FALL")).toBe("Fall");
  });
});
