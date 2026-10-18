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
  const entries = await repository.list(viewerId);

  if (entries.length === 0) {
    return [];
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
  }));
}
