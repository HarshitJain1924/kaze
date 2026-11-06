import "server-only";

import { readTmdbCache, writeTmdbCache } from "@/services/tmdb/cache";
import { tmdbGet } from "@/services/tmdb/client";
import {
  mapCollection,
  mapDetails,
  mapSearchPage,
  mapSeason,
} from "@/services/tmdb/mappers";
import type {
  TmdbDetails,
  TmdbDiscoverCategory,
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

export async function discoverTmdb(
  kind: TmdbKind,
  category: TmdbDiscoverCategory,
  page = 1,
): Promise<TmdbSearchPage> {
  const path =
    category === "trending"
      ? `/trending/${kind}/day`
      : category === "popular"
        ? `/${kind}/popular`
        : category === "top_rated"
          ? `/${kind}/top_rated`
          : kind === "movie"
            ? "/movie/upcoming"
            : "/tv/on_the_air";

  const payload = await tmdbGet<unknown>(path, {
    query: { page, language: "en-US" },
    revalidateSeconds: 900,
  });
  return mapSearchPage(kind, payload);
}

export async function getTmdbDetails(
  kind: TmdbKind,
  tmdbId: number,
): Promise<TmdbDetails> {
  // The version suffix prevents older cached payloads without credits,
  // recommendations or collections from reaching the shared detail view.
  const key = `tmdb:details:v2:${kind}:${tmdbId}`;
  const cached = await readTmdbCache<TmdbDetails>(key);
  if (cached) return cached;

  const path = kind === "movie" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
  const payload = await tmdbGet<unknown>(path, {
    query: {
      language: "en-US",
      append_to_response:
        "external_ids,credits,recommendations,belongs_to_collection,videos",
    },
    revalidateSeconds: 3600,
  });

  let details = mapDetails(kind, payload);

  if (details.collection) {
    try {
      const collectionKey = `tmdb:collection:v2:${details.collection.id}`;
      let collection = await readTmdbCache<typeof details.collection>(
        collectionKey,
      );

      if (!collection) {
        const collectionPayload = await tmdbGet<unknown>(
          `/collection/${details.collection.id}`,
          { query: { language: "en-US" }, revalidateSeconds: 3600 },
        );
        collection = mapCollection(collectionPayload);
        await writeTmdbCache(collectionKey, collection);
      }

      details = { ...details, collection };
    } catch {
      // A collection is contextual navigation. Keep the title usable if the
      // secondary request fails.
    }
  }

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
