import type {
  AiringScheduleEntry,
  AnimeSummary,
} from "@/types/anime";
import type { LibraryItem } from "@/types/library";
import type { Viewer } from "@/types/viewer";
import { toIsoDateString } from "@/lib/schedule";
import { getDisplayTitle } from "@/lib/utils";

export interface SpotlightCandidateOptions {
  currentYear?: number;
}

/**
 * Selects curated spotlight candidates for the Seasonal Feature hero section.
 *
 * Selection signals:
 * 1. Seasonal currency & relevance (current year / active seasonal roster).
 * 2. Visual quality: high-resolution cinematic `bannerImage` is prioritized.
 * 3. Critical acclaim & popularity: `averageScore` and `popularity`.
 * 4. Genre diversity: ensures the 5 candidates represent distinct genre flavors.
 * 5. Deterministic: no random selection; stable across renders.
 */
export function selectSpotlightCandidates(
  seasonalItems: AnimeSummary[],
  trendingItems: AnimeSummary[],
  popularItems: AnimeSummary[],
  options: SpotlightCandidateOptions = {},
): AnimeSummary[] {
  const currentYear = options.currentYear ?? new Date().getFullYear();

  // Combine unique candidate titles
  const poolMap = new Map<number, AnimeSummary>();
  for (const item of [...seasonalItems, ...trendingItems, ...popularItems]) {
    if (!poolMap.has(item.id)) {
      poolMap.set(item.id, item);
    }
  }

  const allCandidates = Array.from(poolMap.values());
  if (allCandidates.length === 0) return [];

  // Score candidates based on available signals
  function scoreCandidate(item: AnimeSummary): number {
    let score = 0;
    // Acclaim signal: averageScore (0-100)
    if (item.averageScore !== null && item.averageScore > 0) {
      score += item.averageScore * 1.5;
    } else {
      score += 105; // default benchmark ~70%
    }

    // Seasonal relevance
    if (item.seasonYear === currentYear) {
      score += 25;
    }

    // Cinematic artwork requirement
    if (item.bannerImage) {
      score += 40;
    }

    return score;
  }

  // Sort candidates by score descending
  const sorted = [...allCandidates].sort(
    (a, b) => scoreCandidate(b) - scoreCandidate(a),
  );

  // Pick up to 5 candidates while maintaining genre diversity
  const selected: AnimeSummary[] = [];
  const coveredGenres = new Set<string>();

  // Pass 1: Select candidates with bannerImage and distinct primary genres
  for (const item of sorted) {
    if (selected.length >= 5) break;
    if (!item.bannerImage) continue;

    const primaryGenre = item.genres[0];
    const isNewGenre = primaryGenre && !coveredGenres.has(primaryGenre);

    if (isNewGenre || selected.length < 3) {
      selected.push(item);
      if (primaryGenre) coveredGenres.add(primaryGenre);
    }
  }

  // Pass 2: Fill remaining slots with highest-ranked banner candidates
  if (selected.length < 5) {
    for (const item of sorted) {
      if (selected.length >= 5) break;
      if (item.bannerImage && !selected.some((x) => x.id === item.id)) {
        selected.push(item);
      }
    }
  }

  // Pass 3: Fallback to highest-ranked candidates even if banner is absent
  if (selected.length < 5) {
    for (const item of sorted) {
      if (selected.length >= 5) break;
      if (!selected.some((x) => x.id === item.id)) {
        selected.push(item);
      }
    }
  }

  return selected;
}

/**
 * Deduplicates the seasonal catalogue against the primary featured hero title.
 * Prevents immediately repeating the hero title as the very first carousel card.
 */
export function deduplicateSeasonal(
  seasonalItems: AnimeSummary[],
  primaryHeroId: number | null | undefined,
): AnimeSummary[] {
  if (!primaryHeroId || seasonalItems.length <= 6) {
    return seasonalItems;
  }

  const heroIndex = seasonalItems.findIndex((it) => it.id === primaryHeroId);
  if (heroIndex === -1) {
    return seasonalItems;
  }

  // Move the primary hero title towards the end so the carousel opens with other seasonal highlights
  const copy = [...seasonalItems];
  const [hero] = copy.splice(heroIndex, 1);
  if (hero) {
    copy.push(hero);
  }
  return copy;
}

/**
 * Deduplicates the Trending ranked list against the primary featured hero.
 * Ensures the #1 hero title isn't redundantly repeated in the top 6 trending list.
 */
export function deduplicateTrending(
  trendingItems: AnimeSummary[],
  primaryHeroId: number | null | undefined,
  limit = 6,
): AnimeSummary[] {
  if (!primaryHeroId || trendingItems.length <= limit) {
    return trendingItems.slice(0, limit);
  }

  const filtered = trendingItems.filter((item) => item.id !== primaryHeroId);
  return (filtered.length >= limit ? filtered : trendingItems).slice(0, limit);
}

/**
 * Curates "On the Reading Table" to ensure balanced, diverse representation
 * of both Manga (Japan) and Manhwa (Korea) from the trending reading pool.
 */
export function curateReadingTable(
  mangaItems: AnimeSummary[],
  limit = 6,
): AnimeSummary[] {
  if (mangaItems.length <= limit) {
    return mangaItems;
  }

  const manhwa = mangaItems.filter((it) => it.countryOfOrigin === "KR");
  const manga = mangaItems.filter((it) => it.countryOfOrigin !== "KR");

  // If manhwa are present, ensure a healthy representation (e.g. 2-3 manhwa and 3-4 manga)
  if (manhwa.length > 0 && manga.length > 0) {
    const targetManhwaCount = Math.min(manhwa.length, 2);
    const targetMangaCount = limit - targetManhwaCount;

    const selectedManga = manga.slice(0, targetMangaCount);
    const selectedManhwa = manhwa.slice(0, targetManhwaCount);

    // Interleave while preserving relative trending positions
    const combined: AnimeSummary[] = [];
    let mi = 0;
    let ki = 0;

    while (combined.length < limit && (mi < selectedManga.length || ki < selectedManhwa.length)) {
      if (mi < selectedManga.length) {
        const m = selectedManga[mi];
        if (m) combined.push(m);
        mi += 1;
      }
      if (ki < selectedManhwa.length && combined.length < limit) {
        const k = selectedManhwa[ki];
        if (k) combined.push(k);
        ki += 1;
      }
    }

    return combined;
  }

  return mangaItems.slice(0, limit);
}

export interface PersonalWatchContext {
  todayTotalCount: number;
  trackedTodayCount: number;
  trackedAiredCount: number;
  trackedUpcomingCount: number;
  readyToWatchCount: number;
  watchingCount: number;
  summaryText: string;
}

/**
 * Accurately calculates personal watch and broadcast context.
 *
 * Distinguishes between:
 * - Episodes already aired and ready to watch today.
 * - Episodes scheduled to air later.
 * - Completed series with unwatched episodes.
 * - Active series caught up with the broadcast.
 *
 * Avoids presenting future scheduled episodes as overdue.
 */
export function calculatePersonalContext({
  viewer,
  items,
  todayEntries,
  activeTimeZone,
  titleLanguage = "english",
  fallbackSummary,
  now = new Date(),
}: {
  viewer: Viewer | null;
  items: LibraryItem[];
  todayEntries: AiringScheduleEntry[] | null | undefined;
  activeTimeZone: string;
  titleLanguage?: "english" | "romaji";
  fallbackSummary?: string;
  now?: Date;
}): PersonalWatchContext {
  if (fallbackSummary) {
    return {
      todayTotalCount: 0,
      trackedTodayCount: 0,
      trackedAiredCount: 0,
      trackedUpcomingCount: 0,
      readyToWatchCount: 0,
      watchingCount: 0,
      summaryText: fallbackSummary,
    };
  }

  const nowMs = now.getTime();
  const todayIso = toIsoDateString(now, activeTimeZone);

  // Map of all schedule entries airing today
  const entriesToday = (todayEntries ?? []).filter(
    (entry) =>
      toIsoDateString(new Date(entry.airingAt * 1000), activeTimeZone) ===
      todayIso,
  );
  const todayTotalCount = entriesToday.length;

  const librarySet = new Set(items.map((it) => it.entry.anilistId));
  const trackedEntriesToday = entriesToday.filter((entry) =>
    librarySet.has(entry.mediaId),
  );
  const trackedTodayCount = trackedEntriesToday.length;

  const trackedAiredEntries = trackedEntriesToday.filter(
    (entry) => entry.airingAt * 1000 <= nowMs,
  );
  const trackedUpcomingEntries = trackedEntriesToday.filter(
    (entry) => entry.airingAt * 1000 > nowMs,
  );

  const trackedAiredCount = trackedAiredEntries.length;
  const trackedUpcomingCount = trackedUpcomingEntries.length;

  // Calculate actual ready-to-watch episodes (WITHOUT counting future unaired episodes)
  const watchingItems = items.filter(
    (it) => it.entry.status === "watching" && it.anime !== null,
  );
  const watchingCount = watchingItems.length;

  let readyToWatchCount = 0;
  let seriesWithReadyCount = 0;

  for (const item of watchingItems) {
    const anime = item.anime;
    if (!anime) continue;

    // 1. Finished series: all episodes are out
    if (anime.status === "FINISHED" && anime.episodes !== null && anime.episodes > 0) {
      if (item.entry.progress < anime.episodes) {
        readyToWatchCount += anime.episodes - item.entry.progress;
        seriesWithReadyCount += 1;
      }
    } else if (anime.status === "RELEASING") {
      // 2. Currently releasing: check if an episode aired today and is unwatched
      const todayEntry = trackedAiredEntries.find((e) => e.mediaId === anime.id);
      if (todayEntry && item.entry.progress < todayEntry.episode) {
        readyToWatchCount += todayEntry.episode - item.entry.progress;
        seriesWithReadyCount += 1;
      }
    }
  }

  // Construct truthful, actionable editorial summary text
  let summaryText = "";

  if (!viewer) {
    summaryText =
      todayTotalCount === 1
        ? "1 broadcast scheduled today across the seasonal timetable. Sign in to track your library and release schedule."
        : `${todayTotalCount} broadcasts scheduled today across the seasonal timetable. Sign in to track your library and release schedule.`;
  } else if (trackedTodayCount > 0) {
    if (trackedAiredCount > 0) {
      const firstAired = trackedAiredEntries[0]?.media;
      const title = firstAired
        ? `"${getDisplayTitle(firstAired.title, titleLanguage === "english")}"`
        : "a tracked series";
      const extraUpcoming =
        trackedUpcomingCount > 0
          ? `, with ${trackedUpcomingCount} more airing later today`
          : "";
      summaryText = `A new episode is ready to watch for ${title}${extraUpcoming}.`;
    } else {
      const firstUpcoming = trackedUpcomingEntries[0]?.media;
      const title = firstUpcoming
        ? `"${getDisplayTitle(firstUpcoming.title, titleLanguage === "english")}"`
        : "tracked series";
      summaryText =
        trackedTodayCount === 1
          ? `${title} is scheduled to air later today on your broadcast calendar.`
          : `${trackedTodayCount} tracked series are scheduled to broadcast later today.`;
    }
  } else if (watchingCount > 0) {
    if (readyToWatchCount > 0) {
      const epWord = readyToWatchCount === 1 ? "episode" : "episodes";
      const serWord = seriesWithReadyCount === 1 ? "series" : "series";
      summaryText = `${readyToWatchCount} ${epWord} ready to watch across ${seriesWithReadyCount} ${serWord} in your archive.`;
    } else {
      summaryText = `You're all caught up with current releases across your ${watchingCount} active ${watchingCount === 1 ? "series" : "series"}.`;
    }
  } else {
    summaryText =
      todayTotalCount > 0
        ? `${todayTotalCount} episodes broadcast today. Explore the seasonal catalogue below to add titles to your shelf.`
        : "Your shelf is ready. Explore the seasonal catalogue below to add titles to your shelf.";
  }

  return {
    todayTotalCount,
    trackedTodayCount,
    trackedAiredCount,
    trackedUpcomingCount,
    readyToWatchCount,
    watchingCount,
    summaryText,
  };
}

