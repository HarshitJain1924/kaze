import { describe, expect, it } from "vitest";

import { getWeekRange, groupScreenScheduleByDay } from "@/lib/schedule";
import type { ScreenScheduleEntry } from "@/types/tmdb";

function entry(
  tmdbId: number,
  date: string,
  title = `Title ${tmdbId}`,
): ScreenScheduleEntry {
  return {
    tmdbId,
    kind: "movie",
    title,
    posterUrl: null,
    year: 2026,
    voteAverage: 7.2,
    date,
  };
}

describe("screen schedule grouping", () => {
  const week = getWeekRange("2026-11-04");
  const dates = week.days.map((day) => day.date);
  const dayAt = (index: number) => dates[index] ?? "";

  it("groups dated releases into their day of the week", () => {
    const days = groupScreenScheduleByDay(
      [entry(1, dayAt(0)), entry(2, dayAt(2))],
      week.days,
    );

    expect(days).toHaveLength(7);
    expect(days[0]?.entries.map((item) => item.tmdbId)).toEqual([1]);
    expect(days[1]?.entries).toHaveLength(0);
    expect(days[2]?.entries.map((item) => item.tmdbId)).toEqual([2]);
  });

  it("drops releases dated outside the week", () => {
    const days = groupScreenScheduleByDay([entry(1, "2026-12-25")], week.days);
    expect(days.every((day) => day.entries.length === 0)).toBe(true);
  });

  it("lists each title once per day", () => {
    const date = dayAt(1);
    const days = groupScreenScheduleByDay(
      [entry(9, date), entry(9, date, "Duplicate row")],
      week.days,
    );
    expect(days[1]?.entries).toHaveLength(1);
  });
});
