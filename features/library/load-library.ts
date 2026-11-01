import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createLibraryRepository } from "@/repositories/library";
import { getCatalogService } from "@/services/catalog/catalog-service";
import type { AnimeSummary, MediaType } from "@/types/anime";
import type { LibraryItem } from "@/types/library";

/**
 * Loads the signed-in viewer's library and hydrates entries with AniList
 * summaries in as few provider requests as possible.
 *
 * If AniList is unavailable the entries are still returned with
 * `anime: null`, so users never lose access to their own progress, ratings
 * or notes.
 *
 * If individual episode-record fetching fails, entries are returned without
 * an empty `watchedEpisodes` array so the system does not incorrectly overwrite
 * or misinterpret failed queries as a genuine "zero episodes watched" record.
 */
export async function loadLibraryItems(
  viewerId: string,
): Promise<LibraryItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [];
  }

  const repository = createLibraryRepository(supabase);

  // Load library entries and individual watched-episode history in parallel
  const [entries, rawEpisodesResult] = await Promise.all([
    repository.list(viewerId),
    repository
      .listEpisodes(viewerId)
      .then((records) => ({ ok: true as const, records }))
      .catch((err) => {
        // Log sanitized error without leaking sensitive internals
        console.error(
          "[library] failed to load episode history; preserving aggregate progress",
          err instanceof Error ? err.message : "database query error",
        );
        return { ok: false as const, error: err };
      }),
  ]);

  if (entries.length === 0) {
    return [];
  }

  const episodesByAnime = new Map<number, number[]>();
  if (rawEpisodesResult.ok) {
    for (const ep of rawEpisodesResult.records) {
      let list = episodesByAnime.get(ep.anilistId);
      if (!list) {
        list = [];
        episodesByAnime.set(ep.anilistId, list);
      }
      list.push(ep.episodeNumber);
    }
    for (const list of episodesByAnime.values()) {
      list.sort((a, b) => a - b);
    }
  }

  const idsByType: Record<MediaType, number[]> = {
    anime: [],
    manga: [],
  };
  for (const entry of entries) {
    idsByType[entry.mediaType === "manga" ? "manga" : "anime"].push(
      entry.anilistId,
    );
  }

  const mediaById = new Map<number, AnimeSummary>();
  const [animeHydrated, mangaHydrated] = await Promise.allSettled([
    idsByType.anime.length > 0
      ? getCatalogService()
          .getAnimeByIds(idsByType.anime)
          .then((result) => result.data)
      : Promise.resolve(new Map<number, AnimeSummary>()),
    idsByType.manga.length > 0
      ? getCatalogService()
          .getMangaByIds(idsByType.manga)
          .then((result) => result.data)
      : Promise.resolve(new Map<number, AnimeSummary>()),
  ]);

  if (animeHydrated.status === "fulfilled") {
    for (const [id, summary] of animeHydrated.value) {
      mediaById.set(id, summary);
    }
  } else {
    console.error(
      "[library] could not hydrate anime metadata; entries kept without metadata",
      animeHydrated.reason instanceof Error
        ? animeHydrated.reason.message
        : "Catalog request error",
    );
  }

  if (mangaHydrated.status === "fulfilled") {
    for (const [id, summary] of mangaHydrated.value) {
      mediaById.set(id, summary);
    }
  } else {
    console.error(
      "[library] could not hydrate manga metadata; entries kept without metadata",
      mangaHydrated.reason instanceof Error
        ? mangaHydrated.reason.message
        : "Catalog request error",
    );
  }

  return entries.map((entry) => ({
    entry,
    anime: mediaById.get(entry.anilistId) ?? null,
    ...(rawEpisodesResult.ok && entry.mediaType !== "manga"
      ? { watchedEpisodes: episodesByAnime.get(entry.anilistId) ?? [] }
      : {}),
  }));
}
