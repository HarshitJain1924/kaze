import "server-only";

import { readTmdbCache, writeTmdbCache } from "@/services/tmdb/cache";
import { tmdbGet } from "@/services/tmdb/client";
import { mapDetails, mapSearchPage, mapSeason } from "@/services/tmdb/mappers";
import type {
  TmdbDetails,
  TmdbKind,
  TmdbSearchPage,
  TmdbSeasonDetails,
} from "@/types/tmdb";

export async function searchTmdb(
  kind: TmdbKind,
  query: string,
  page = 1,
): Promise<TmdbSearchPage> {
  const path = kind === "movie" ? "/search/movie" : "/search/tv";
  const payload = await tmdbGet<unknown>(path, {
    query: {
      query,
      page,
      include_adult: false,
      language: "en-US",
    },
    revalidateSeconds: 600,
  });
  return mapSearchPage(kind, payload);
}

export async function getTmdbDetails(
  kind: TmdbKind,
  tmdbId: number,
): Promise<TmdbDetails> {
  const key = `tmdb:details:${kind}:${tmdbId}`;
  const cached = await readTmdbCache<TmdbDetails>(key);
  if (cached) return cached;

  const path = kind === "movie" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
  const payload = await tmdbGet<unknown>(path, {
    query: { language: "en-US", append_to_response: "external_ids" },
    revalidateSeconds: 3600,
  });
  const details = mapDetails(kind, payload);
  await writeTmdbCache(key, details);
  return details;
}

export async function getTmdbSeason(
  tmdbId: number,
  seasonNumber: number,
): Promise<TmdbSeasonDetails> {
  const key = `tmdb:season:${tmdbId}:${seasonNumber}`;
  const cached = await readTmdbCache<TmdbSeasonDetails>(key);
  if (cached) return cached;

  const payload = await tmdbGet<unknown>(
    `/tv/${tmdbId}/season/${seasonNumber}`,
    { query: { language: "en-US" }, revalidateSeconds: 3600 },
  );
  const season = mapSeason(tmdbId, payload);
  await writeTmdbCache(key, season);
  return season;
}
