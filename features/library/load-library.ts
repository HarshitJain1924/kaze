import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createLibraryRepository } from "@/repositories/library";
import { getCatalogService } from "@/services/catalog/catalog-service";
import type { AnimeSummary } from "@/types/anime";
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

  let animeById = new Map<number, AnimeSummary>();
  try {
    animeById = await getCatalogService().getAnimeByIds(
      entries.map((entry) => entry.anilistId),
    );
  } catch (error) {
    console.error(
      "[library] could not hydrate anime metadata; entries kept without metadata",
      error instanceof Error ? error.message : "Catalog request error",
    );
  }

  return entries.map((entry) => ({
    entry,
    anime: animeById.get(entry.anilistId) ?? null,
    ...(rawEpisodesResult.ok
      ? { watchedEpisodes: episodesByAnime.get(entry.anilistId) ?? [] }
      : {}),
  }));
}
