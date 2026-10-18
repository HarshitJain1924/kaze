import { describe, expect, it } from "vitest";

import {
  formatAiringRelative,
  formatAiringTime,
  getWeekRange,
  groupScheduleByDay,
} from "@/lib/schedule";
import type { AiringScheduleEntry } from "@/types/anime";

describe("schedule utilities", () => {
  it("computes Monday-to-Sunday week range for a given date", () => {
    // 2026-10-21 is a Wednesday
    const wednesday = new Date("2026-10-21T12:00:00Z");
    const range = getWeekRange(wednesday);

    expect(range.days).toHaveLength(7);
    expect(range.days[0]?.dayName).toBe("Monday");
    expect(range.days[0]?.dayShort).toBe("Mon");
    expect(range.days[6]?.dayName).toBe("Sunday");
    expect(range.days[6]?.dayShort).toBe("Sun");

    // Start is before end
    expect(range.airingAtGreater).toBeLessThan(range.airingAtLesser);

    // Prev and next week navigation
    expect(range.prevWeekDate).toBeDefined();
    expect(range.nextWeekDate).toBeDefined();
    expect(range.weekLabel).toContain("Oct");
  });

  it("handles Sunday correctly by keeping Monday as the first day of that week", () => {
    // 2026-10-25 is a Sunday
    const sunday = new Date("2026-10-25T15:00:00Z");
    const range = getWeekRange(sunday);

    expect(range.days[0]?.dayName).toBe("Monday");
    expect(range.days[6]?.dayName).toBe("Sunday");
  });

  it("groups schedule entries by day and sorts by airing time", () => {
    const range = getWeekRange(new Date("2026-10-21T12:00:00Z"));
    const mondayDate = range.days[0]?.date ?? "2026-10-19";

    const baseSec = Math.floor(new Date(`${mondayDate}T12:00:00Z`).getTime() / 1000);

    const mockEntry = (id: number, offsetSec: number): AiringScheduleEntry => ({
      id,
      airingAt: baseSec + offsetSec,
      timeUntilAiring: offsetSec,
      episode: id,
      mediaId: 100 + id,
      media: {
        id: 100 + id,
        title: { romaji: `Anime ${id}`, english: `Anime ${id}`, native: null },
        coverImage: { large: null, extraLarge: null, color: null },
        format: "TV",
        episodes: 12,
        averageScore: 80,
        seasonYear: 2026,
        status: "RELEASING",
        genres: ["Action"],
      },
    });

    const entries = [
      mockEntry(2, 3600), // later on Monday
      mockEntry(1, 0),    // earlier on Monday
    ];

    const grouped = groupScheduleByDay(entries, range.days);
    expect(grouped).toHaveLength(7);

    const mondayGroup = grouped[0];
    expect(mondayGroup?.entries).toHaveLength(2);
    expect(mondayGroup?.entries[0]?.id).toBe(1);
    expect(mondayGroup?.entries[1]?.id).toBe(2);
  });

  it("formats relative airing times", () => {
    const now = 1_000_000_000_000;
    // 2 hours in future
    const futureSec = Math.floor((now + 2 * 3600 * 1000) / 1000);
    const relFuture = formatAiringRelative(futureSec, now);
    expect(relFuture.hasAired).toBe(false);
    expect(relFuture.label).toBe("In 2h");

    // 1 hour in past
    const pastSec = Math.floor((now - 3600 * 1000) / 1000);
    const relPast = formatAiringRelative(pastSec, now);
    expect(relPast.hasAired).toBe(true);
    expect(relPast.label).toBe("Aired 1h ago");
  });

  it("formats local airing time string", () => {
    const sample = Math.floor(new Date("2026-10-20T20:30:00Z").getTime() / 1000);
    const timeStr = formatAiringTime(sample);
    expect(typeof timeStr).toBe("string");
    expect(timeStr.length).toBeGreaterThan(0);
  });
});
