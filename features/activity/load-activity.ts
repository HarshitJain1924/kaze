import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createLibraryRepository } from "@/repositories/library";
import { createTmdbLibraryRepository } from "@/repositories/tmdb-library";
import { getCatalogService } from "@/services/catalog/catalog-service";
import type { AnimeSummary, MediaType } from "@/types/anime";
import type { Database } from "@/types/database";
import type { LibraryEntry, LibraryItem, WatchedEpisode } from "@/types/library";
import type {
  TmdbLibraryEntry,
  TmdbWatchedEpisode,
} from "@/types/tmdb";

/** Newest episode rows pulled for the feed; the page never reads full history. */
export const RECENT_EPISODE_LIMIT = 400;
/** Completed titles counted per source when bounding the feed. */
export const RECENT_COMPLETION_LIMIT = 60;
/** Upper bound on catalogue lookups, so a huge archive cannot stall the page. */
export const MAX_HYDRATED_TITLES = 240;

export interface ActivitySource {
  libraryItems: LibraryItem[];
  animeEpisodes: WatchedEpisode[];
  screenEntries: TmdbLibraryEntry[];
  screenEpisodes: TmdbWatchedEpisode[];
}

function byRecentCompletion(a: LibraryEntry, b: LibraryEntry): number {
  return (a.completedAt ?? "") < (b.completedAt ?? "") ? 1 : -1;
}

/**
 * Loads only what the log can display: the newest episode rows from both
 * catalogues, the completions at the top of each ledger, and catalogue
 * metadata for just the titles those rows mention.
 *
 * Cost is O(limit), not O(library): every query is capped and metadata is
 * hydrated for at most `MAX_HYDRATED_TITLES` ids.
 */
export async function loadActivitySource(
  supabase: SupabaseClient<Database>,
  viewerId: string,
): Promise<ActivitySource> {
  const libraryRepository = createLibraryRepository(supabase);
  const screenRepository = createTmdbLibraryRepository(supabase);

  const [animeEpisodes, screenEpisodes, entries, screenEntriesAll] =
    await Promise.all([
      libraryRepository
        .listRecentEpisodes(viewerId, RECENT_EPISODE_LIMIT)
        .catch(() => [] as WatchedEpisode[]),
      screenRepository
        .listRecentEpisodes(viewerId, RECENT_EPISODE_LIMIT)
        .catch(() => [] as TmdbWatchedEpisode[]),
      libraryRepository.list(viewerId).catch(() => [] as LibraryEntry[]),
      screenRepository.list(viewerId).catch(() => [] as TmdbLibraryEntry[]),
    ]);

  const recentCompletions = [...entries]
    .filter((entry) => entry.completedAt !== null)
    .sort(byRecentCompletion)
    .slice(0, RECENT_COMPLETION_LIMIT);

  // Episode ids arrive newest-first, so the cap keeps the most recent titles.
  const wantedIds: number[] = [];
  const seen = new Set<number>();
  for (const episode of animeEpisodes) {
    if (seen.has(episode.anilistId)) continue;
    seen.add(episode.anilistId);
    wantedIds.push(episode.anilistId);
  }
  for (const entry of recentCompletions) {
    if (seen.has(entry.anilistId)) continue;
    seen.add(entry.anilistId);
    wantedIds.push(entry.anilistId);
  }
  const selectedIds = new Set(wantedIds.slice(0, MAX_HYDRATED_TITLES));

  const selectedEntries = entries.filter((entry) =>
    selectedIds.has(entry.anilistId),
  );

  const idsByType: Record<MediaType, number[]> = { anime: [], manga: [] };
  for (const entry of selectedEntries) {
    idsByType[entry.mediaType === "manga" ? "manga" : "anime"].push(
      entry.anilistId,
    );
  }

  const catalog = getCatalogService();
  const [animeResult, mangaResult] = await Promise.allSettled([
    idsByType.anime.length > 0
      ? catalog.getAnimeByIds(idsByType.anime).then((result) => result.data)
      : Promise.resolve(new Map<number, AnimeSummary>()),
    idsByType.manga.length > 0
      ? catalog.getMangaByIds(idsByType.manga).then((result) => result.data)
      : Promise.resolve(new Map<number, AnimeSummary>()),
  ]);

  const mediaById = new Map<number, AnimeSummary>();
  if (animeResult.status === "fulfilled") {
    for (const [id, summary] of animeResult.value) mediaById.set(id, summary);
  }
  if (mangaResult.status === "fulfilled") {
    for (const [id, summary] of mangaResult.value) mediaById.set(id, summary);
  }

  const libraryItems: LibraryItem[] = selectedEntries.map((entry) => ({
    entry,
    anime: mediaById.get(entry.anilistId) ?? null,
  }));

  const screenEpisodeEntryIds = new Set(
    screenEpisodes.map((episode) => episode.entryId),
  );
  const recentScreenCompletions = [...screenEntriesAll]
    .filter((entry) => entry.completedAt !== null)
    .sort((a, b) => ((a.completedAt ?? "") < (b.completedAt ?? "") ? 1 : -1))
    .slice(0, RECENT_COMPLETION_LIMIT);

  const keepScreenIds = new Set<string>([
    ...screenEpisodeEntryIds,
    ...recentScreenCompletions.map((entry) => entry.id),
  ]);

  return {
    libraryItems,
    animeEpisodes,
    screenEpisodes,
    screenEntries: screenEntriesAll.filter((entry) =>
      keepScreenIds.has(entry.id),
    ),
  };
}
