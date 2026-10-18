import "server-only";

import { getAniListClient } from "@/services/anilist/client";

/**
 * Resolves the provider episode count used to bound progress updates.
 * Returns `null` when the count is unknown or AniList is unreachable; the
 * repository then validates progress as unbounded but still nonnegative.
 */
export async function resolveEpisodeCount(
  anilistId: number,
): Promise<number | null> {
  try {
    const anime = await getAniListClient().getAnimeById(anilistId);
    return anime?.episodes ?? null;
  } catch (error) {
    console.warn(
      `[library] could not verify episode count for anime ${anilistId}`,
      error,
    );
    return null;
  }
}
