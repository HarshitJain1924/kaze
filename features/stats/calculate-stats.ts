import { MAX_SCORE, MIN_SCORE, WATCH_STATUSES } from "@/types/library";
import type { LibraryItem, WatchStatus } from "@/types/library";

export interface ScoreBucket {
  score: number;
  count: number;
}

export interface GenreCount {
  genre: string;
  count: number;
}

export interface LibraryStats {
  total: number;
  statusCounts: Record<WatchStatus, number>;
  episodesWatched: number;
  /** Entries whose provider episode total is missing or unknown. */
  entriesWithUnknownEpisodeTotals: number;
  /** Entries whose AniList metadata could not be loaded at all. */
  missingMetadataCount: number;
  scoredCount: number;
  averageScore: number | null;
  scoreDistribution: ScoreBucket[];
  genreDistribution: GenreCount[];
}

const EMPTY_STATUS_COUNTS: Record<WatchStatus, number> = {
  watching: 0,
  completed: 0,
  planning: 0,
  on_hold: 0,
  dropped: 0,
};

function roundOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Statistics are derived only from data the application actually records:
 * library entries plus AniList metadata. No watch time or historical trends
 * are estimated.
 */
export function calculateStats(items: LibraryItem[]): LibraryStats {
  const statusCounts: Record<WatchStatus, number> = { ...EMPTY_STATUS_COUNTS };
  const scoreCounts = new Map<number, number>();
  const genreCounts = new Map<string, number>();

  let episodesWatched = 0;
  let entriesWithUnknownEpisodeTotals = 0;
  let missingMetadataCount = 0;
  let scoreTotal = 0;
  let scoredCount = 0;

  for (const item of items) {
    const { entry, anime } = item;
    if (WATCH_STATUSES.includes(entry.status)) {
      statusCounts[entry.status] += 1;
    }

    episodesWatched += entry.progress;

    if (anime === null) {
      missingMetadataCount += 1;
    }

    if (entry.progress > 0) {
      if (!anime || anime.episodes === null || anime.episodes <= 0) {
        entriesWithUnknownEpisodeTotals += 1;
      }
    }

    if (entry.score !== null && Number.isInteger(entry.score)) {
      const score = Math.min(MAX_SCORE, Math.max(MIN_SCORE, entry.score));
      scoreCounts.set(score, (scoreCounts.get(score) ?? 0) + 1);
      scoreTotal += score;
      scoredCount += 1;
    }

    for (const genre of anime?.genres ?? []) {
      const name = genre.trim();
      if (name) {
        genreCounts.set(name, (genreCounts.get(name) ?? 0) + 1);
      }
    }
  }

  const scoreDistribution: ScoreBucket[] = [];
  for (let score = MIN_SCORE; score <= MAX_SCORE; score += 1) {
    scoreDistribution.push({ score, count: scoreCounts.get(score) ?? 0 });
  }

  const genreDistribution = [...genreCounts.entries()]
    .map(([genre, count]) => ({ genre, count }))
    .sort(
      (a, b) => b.count - a.count || a.genre.localeCompare(b.genre),
    );

  return {
    total: items.length,
    statusCounts,
    episodesWatched,
    entriesWithUnknownEpisodeTotals,
    missingMetadataCount,
    scoredCount,
    averageScore:
      scoredCount > 0 ? roundOneDecimal(scoreTotal / scoredCount) : null,
    scoreDistribution,
    genreDistribution,
  };
}
