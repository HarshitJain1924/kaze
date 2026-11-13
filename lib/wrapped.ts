import type { TmdbLibraryItem } from "@/types/tmdb";

/** Runtime assumptions used for the estimated film and TV screen time. */
export const FILM_RUNTIME_HOURS = 2;
export const TV_EPISODE_RUNTIME_MINUTES = 45;

export interface ScreenWrappedSummary {
  filmsTracked: number;
  filmsWatched: number;
  seriesTracked: number;
  seriesFinished: number;
  episodesWatched: number;
  estimatedHours: number;
}

function isWatched(item: TmdbLibraryItem): boolean {
  return (
    item.entry.watched ||
    item.entry.status === "completed" ||
    item.watchedCount > 0
  );
}

/** Film and TV side of Wrapped: counts plus an estimated runtime. */
export function summarizeScreenLibrary(
  items: TmdbLibraryItem[],
): ScreenWrappedSummary {
  let filmsTracked = 0;
  let filmsWatched = 0;
  let seriesTracked = 0;
  let seriesFinished = 0;
  let episodesWatched = 0;

  for (const item of items) {
    if (item.entry.mediaType === "movie") {
      filmsTracked += 1;
      if (isWatched(item)) filmsWatched += 1;
      continue;
    }
    seriesTracked += 1;
    episodesWatched += item.watchedCount;
    if (item.entry.status === "completed") seriesFinished += 1;
  }

  const estimatedHours = Math.round(
    filmsWatched * FILM_RUNTIME_HOURS +
      (episodesWatched * TV_EPISODE_RUNTIME_MINUTES) / 60,
  );

  return {
    filmsTracked,
    filmsWatched,
    seriesTracked,
    seriesFinished,
    episodesWatched,
    estimatedHours,
  };
}

/**
 * "2024–2026 Archive" for the oldest tracked row, or "All-time archive" when
 * nothing has a usable creation date. Wrapped reflects the whole library, so
 * the label describes the span instead of claiming a calendar year.
 */
export function archiveRangeLabel(
  dates: ReadonlyArray<string | null | undefined>,
  now: Date = new Date(),
): string {
  let earliest = Number.POSITIVE_INFINITY;
  for (const date of dates) {
    if (!date) continue;
    const stamp = new Date(date).getTime();
    if (Number.isFinite(stamp) && stamp < earliest) earliest = stamp;
  }

  if (!Number.isFinite(earliest)) return "All-time archive";

  const startYear = new Date(earliest).getFullYear();
  const endYear = now.getFullYear();
  return startYear === endYear
    ? `${endYear} archive`
    : `${startYear}–${endYear} archive`;
}
