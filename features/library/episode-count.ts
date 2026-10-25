import "server-only";

import { getCatalogService } from "@/services/catalog/catalog-service";

/**
 * Resolves the provider episode count used to bound progress updates.
 * Returns `null` when the count is unknown or upstream catalogue is unreachable;
 * the repository then validates progress as unbounded but still nonnegative.
 */
export async function resolveEpisodeCount(
  anilistId: number,
): Promise<number | null> {
  try {
    const { data: anime } = await getCatalogService().getAnimeById(anilistId);
    return anime?.episodes ?? null;
  } catch (error) {
    console.warn(
      `[library] could not verify episode count for anime ${anilistId}`,
      error instanceof Error ? error.message : "catalog error",
    );
    return null;
  }
}

/**
 * Uses the episode total the client already has, including an explicit `null`
 * ("provider reports no total"), and only consults the catalogue when the
 * client omitted it. Episode toggles then avoid a provider round trip, which
 * is what made checking an episode occasionally take seconds while AniList
 * was slow or rate limited.
 */
export async function resolveEpisodeTotal(
  provided: number | null | undefined,
  anilistId: number,
): Promise<number | null> {
  if (provided !== undefined) {
    return provided;
  }
  return resolveEpisodeCount(anilistId);
}
