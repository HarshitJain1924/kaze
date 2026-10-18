import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createLibraryRepository } from "@/repositories/library";
import { getAniListClient } from "@/services/anilist/client";
import type { AnimeSummary } from "@/types/anime";
import type { LibraryItem } from "@/types/library";

/**
 * Loads the signed-in viewer's library and hydrates entries with AniList
 * summaries in as few provider requests as possible.
 *
 * If AniList is unavailable the entries are still returned with
 * `anime: null`, so users never lose access to their own progress, ratings
 * or notes. The UI renders an explicit unavailable state for those rows
 * instead of inventing metadata.
 */
export async function loadLibraryItems(
  viewerId: string,
): Promise<LibraryItem[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return [];
  }

  const repository = createLibraryRepository(supabase);
  const [entries, rawEpisodes] = await Promise.all([
    repository.list(viewerId),
    repository.listEpisodes(viewerId).catch((err) => {
      console.error("[library] could not load episode records", err);
      return [];
    }),
  ]);

  if (entries.length === 0) {
    return [];
  }

  const episodesByAnime = new Map<number, number[]>();
  for (const ep of rawEpisodes) {
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

  let animeById = new Map<number, AnimeSummary>();
  try {
    animeById = await getAniListClient().getAnimeByIds(
      entries.map((entry) => entry.anilistId),
    );
  } catch (error) {
    console.error(
      "[library] could not hydrate anime metadata; entries kept without metadata",
      error,
    );
  }

  return entries.map((entry) => ({
    entry,
    anime: animeById.get(entry.anilistId) ?? null,
    watchedEpisodes: episodesByAnime.get(entry.anilistId) ?? [],
  }));
}
