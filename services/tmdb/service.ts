import "server-only";

import { readTmdbCache, writeTmdbCache } from "@/services/tmdb/cache";
import { tmdbGet } from "@/services/tmdb/client";
import {
  mapCollection,
  mapDetails,
  mapSearchPage,
  mapSeason,
} from "@/services/tmdb/mappers";
import {
  isTmdbSortForKind,
  type TmdbDetails,
  type TmdbDiscoverCategory,
  type TmdbDiscoverFilters,
  type TmdbDiscoverSort,
  type TmdbKind,
  type TmdbSearchPage,
  type TmdbSeasonDetails,
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

function defaultSortForCategory(
  kind: TmdbKind,
  category: TmdbDiscoverCategory,
): TmdbDiscoverSort {
  if (category === "top_rated") return "vote_average.desc";
  if (category === "upcoming") {
    return kind === "movie"
      ? "primary_release_date.asc"
      : "first_air_date.asc";
  }
  return "popularity.desc";
}

function hasDiscoverFilters(filters: TmdbDiscoverFilters): boolean {
  return Boolean(
    filters.genre ||
      filters.year ||
      filters.minRating !== undefined ||
      filters.sort,
  );
}

export async function discoverTmdb(
  kind: TmdbKind,
  category: TmdbDiscoverCategory,
  page = 1,
  filters: TmdbDiscoverFilters = {},
): Promise<TmdbSearchPage> {
  // TMDB's curated feeds do not accept genre/year/rating constraints, so any
  // active filter moves the request onto the discover endpoint.
  if (hasDiscoverFilters(filters)) {
    const sort =
      filters.sort && isTmdbSortForKind(kind, filters.sort)
        ? filters.sort
        : defaultSortForCategory(kind, category);
    const query: Record<string, string | number> = {
      page,
      language: "en-US",
      sort_by: sort,
    };

    if (filters.genre) query.with_genres = filters.genre;
    if (filters.year) {
      query[kind === "movie" ? "primary_release_year" : "first_air_date_year"] =
        filters.year;
    }
    if (filters.minRating !== undefined) {
      query["vote_average.gte"] = filters.minRating;
    }
    if (sort === "vote_average.desc" || filters.minRating !== undefined) {
      // Rating sorts surface unknown titles with a handful of votes.
      query["vote_count.gte"] = 100;
    }

    const filtered = await tmdbGet<unknown>(`/discover/${kind}`, {
      query,
      revalidateSeconds: 900,
    });
    return mapSearchPage(kind, filtered);
  }

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
