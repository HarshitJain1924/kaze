import type { AnimeSeason } from "@/types/anime";

export interface SeasonInfo {
  season: AnimeSeason;
  year: number;
}

/**
 * Anime seasons follow the calendar quarter used by AniList/MAL:
 * Winter Jan–Mar, Spring Apr–Jun, Summer Jul–Sep, Fall Oct–Dec.
 */
export function getSeasonForDate(date: Date = new Date()): SeasonInfo {
  const month = date.getUTCMonth();
  const year = date.getUTCFullYear();

  if (month <= 2) {
    return { season: "WINTER", year };
  }
  if (month <= 5) {
    return { season: "SPRING", year };
  }
  if (month <= 8) {
    return { season: "SUMMER", year };
  }
  return { season: "FALL", year };
}

export function getCurrentSeason(now: Date = new Date()): SeasonInfo {
  return getSeasonForDate(now);
}

export function seasonLabel(season: AnimeSeason): string {
  switch (season) {
    case "WINTER":
      return "Winter";
    case "SPRING":
      return "Spring";
    case "SUMMER":
      return "Summer";
    case "FALL":
      return "Fall";
  }
}
