import { MAX_SCORE, MIN_SCORE, WATCH_STATUSES } from "@/types/library";
import type { WatchStatus } from "@/types/library";
import type { TmdbLibraryEntry, TmdbWatchedEpisode } from "@/types/tmdb";

export interface ScreenLibraryStats {
  total: number;
  movieCount: number;
  tvCount: number;
  /** Films marked watched. */
  watchedFilms: number;
  /** TV episode rows recorded across every tracked series. */
  episodesWatched: number;
  statusCounts: Record<WatchStatus, number>;
  scoredCount: number;
  averageScore: number | null;
}

const EMPTY_STATUS_COUNTS: Record<WatchStatus, number> = {
  watching: 0,
  completed: 0,
  planning: 0,
  on_hold: 0,
  dropped: 0,
};

/**
 * Film and TV statistics come from the TMDB library rows plus the episodes the
 * viewer has ticked off. Nothing is estimated.
 */
export function calculateScreenStats(
  entries: TmdbLibraryEntry[],
  episodes: TmdbWatchedEpisode[],
): ScreenLibraryStats {
  const statusCounts: Record<WatchStatus, number> = { ...EMPTY_STATUS_COUNTS };

  let movieCount = 0;
  let tvCount = 0;
  let watchedFilms = 0;
  let scoredCount = 0;
  let scoreTotal = 0;

  for (const entry of entries) {
    if (entry.mediaType === "movie") {
      movieCount += 1;
      if (entry.watched) watchedFilms += 1;
    } else {
      tvCount += 1;
    }

    if (WATCH_STATUSES.includes(entry.status)) {
      statusCounts[entry.status] += 1;
    }

    if (entry.score !== null && Number.isInteger(entry.score)) {
      const score = Math.min(MAX_SCORE, Math.max(MIN_SCORE, entry.score));
      scoreTotal += score;
      scoredCount += 1;
    }
  }

  const entryIds = new Set(entries.map((entry) => entry.id));
  const episodesWatched = episodes.filter((episode) =>
    entryIds.has(episode.entryId),
  ).length;

  return {
    total: entries.length,
    movieCount,
    tvCount,
    watchedFilms,
    episodesWatched,
    statusCounts,
    scoredCount,
    averageScore:
      scoredCount > 0 ? Math.round((scoreTotal / scoredCount) * 10) / 10 : null,
  };
}
