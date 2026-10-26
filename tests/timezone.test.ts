import { describe, expect, it } from "vitest";

import {
  COMMON_TIMEZONES,
  formatAiringTime,
  getTimeZoneAbbr,
  getTimeZoneDisplayName,
  getWeekRange,
  groupScheduleByDay,
} from "@/lib/schedule";
import type { AiringScheduleEntry } from "@/types/anime";

describe("Timezone formatting and grouping", () => {
  it("includes essential common timezones", () => {
    const values = COMMON_TIMEZONES.map((tz) => tz.value);
    expect(values).toContain("auto");
    expect(values).toContain("Asia/Tokyo");
    expect(values).toContain("Asia/Kolkata");
    expect(values).toContain("America/New_York");
    expect(values).toContain("UTC");
  });

  it("extracts short timezone abbreviations", () => {
    const testDate = new Date("2026-10-26T12:00:00Z");
    const testSec = Math.floor(testDate.getTime() / 1000);

    const abbrTokyo = getTimeZoneAbbr(testSec, "Asia/Tokyo");
    expect(["JST", "GMT+9", "UTC+9"]).toContain(abbrTokyo);

    const abbrKolkata = getTimeZoneAbbr(testSec, "Asia/Kolkata");
    expect(["IST", "GMT+5:30", "UTC+5:30"]).toContain(abbrKolkata);

    const abbrUTC = getTimeZoneAbbr(testSec, "UTC");
    expect(abbrUTC).toBe("UTC");
  });

  it("formats airing time with and without timezone label", () => {
    // 2026-10-26T14:30:00Z
    const airingSec = Math.floor(new Date("2026-10-26T14:30:00Z").getTime() / 1000);

    // In Asia/Kolkata (+5:30) -> 20:00 (8:00 PM)
    const formattedKolkata = formatAiringTime(airingSec, "Asia/Kolkata");
    expect(formattedKolkata).toMatch(/8:00\s?PM/);

    // In Asia/Tokyo (+9:00) -> 23:30 (11:30 PM)
    const formattedTokyo = formatAiringTime(airingSec, "Asia/Tokyo");
    expect(formattedTokyo).toMatch(/11:30\s?PM/);

    // In America/New_York (EDT, UTC-4 in late Oct) -> 10:30 AM
    const formattedNY = formatAiringTime(airingSec, "America/New_York");
    expect(formattedNY).toMatch(/10:30\s?AM/);

    // With includeZone: true
    const formattedWithZone = formatAiringTime(airingSec, "Asia/Kolkata", {
      includeZone: true,
    });
    expect(formattedWithZone).toMatch(/8:00\s?PM/);
  });

  it("shifts episode grouping across day boundaries based on active timezone", () => {
    // Airs at 2026-10-26T22:00:00Z (Monday night 10:00 PM UTC)
    // In Tokyo (UTC+9): Tuesday, Oct 27 at 07:00 AM (next day!)
    // In New York (UTC-4): Monday, Oct 26 at 06:00 PM (same day)
    // In Kolkata (UTC+5:30): Tuesday, Oct 27 at 03:30 AM (next day!)
    const airingSec = Math.floor(new Date("2026-10-26T22:00:00Z").getTime() / 1000);
    const week = getWeekRange("2026-10-26");

    const sampleEntry: AiringScheduleEntry = {
      id: 101,
      airingAt: airingSec,
      timeUntilAiring: 0,
      episode: 1,
      mediaId: 500,
      media: {
        id: 500,
        title: { romaji: "Midnight Broadcast", english: "Midnight Broadcast", native: null },
        coverImage: { large: null, extraLarge: null, color: null },
        format: "TV",
        episodes: 12,
        averageScore: 85,
        seasonYear: 2026,
        status: "RELEASING",
        genres: ["Action"],
      },
    };

    // Grouping in America/New_York -> belongs to Oct 26 (Monday)
    const nyDays = groupScheduleByDay([sampleEntry], week.days, "America/New_York");
    const monNY = nyDays.find((d) => d.date === "2026-10-26");
    const tueNY = nyDays.find((d) => d.date === "2026-10-27");
    expect(monNY?.entries.map((e) => e.id)).toEqual([101]);
    expect(tueNY?.entries).toHaveLength(0);

    // Grouping in Asia/Tokyo -> belongs to Oct 27 (Tuesday)
    const tokyoDays = groupScheduleByDay([sampleEntry], week.days, "Asia/Tokyo");
    const monTokyo = tokyoDays.find((d) => d.date === "2026-10-26");
    const tueTokyo = tokyoDays.find((d) => d.date === "2026-10-27");
    expect(monTokyo?.entries).toHaveLength(0);
    expect(tueTokyo?.entries.map((e) => e.id)).toEqual([101]);

    // Grouping in Asia/Kolkata -> belongs to Oct 27 (Tuesday)
    const kolkataDays = groupScheduleByDay([sampleEntry], week.days, "Asia/Kolkata");
    const monKolkata = kolkataDays.find((d) => d.date === "2026-10-26");
    const tueKolkata = kolkataDays.find((d) => d.date === "2026-10-27");
    expect(monKolkata?.entries).toHaveLength(0);
    expect(tueKolkata?.entries.map((e) => e.id)).toEqual([101]);
  });

  it("formats display name correctly for auto and custom timezones", () => {
    const custom = getTimeZoneDisplayName("Asia/Tokyo");
    expect(custom).toContain("Asia/Tokyo");

    const autoDisplay = getTimeZoneDisplayName("auto", "Asia/Kolkata");
    expect(autoDisplay).toContain("Asia/Kolkata");
  });
});
