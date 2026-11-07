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
  buildTmdbUniverse,
  isListableUniverseEntry,
  matchTmdbUniverse,
  type TmdbUniverseDefinition,
} from "@/lib/tmdb/universes";
import {
  isTmdbSortForKind,
  type TmdbDetails,
  type TmdbDiscoverCategory,
  type TmdbDiscoverFilters,
  type TmdbDiscoverSort,
  type TmdbKind,
  type TmdbSearchPage,
  type TmdbSeasonDetails,
  type TmdbUniverse,
  type TmdbUniverseEntry,
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
      // TMDB's API carries no 18+ titles, so adult results never come back.
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
    filters.genres?.length ||
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
    const query: Record<string, string | number | boolean> = {
      page,
      language: "en-US",
      sort_by: sort,
    };

    if (filters.genres?.length) {
      // A pipe keeps the selection additive: any of the chosen genres matches.
      query.with_genres = filters.genres.join("|");
    }
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

const UNIVERSE_PAGE_SIZE = 20;
const UNIVERSE_MAX_PAGES = 5;

interface UniverseRoster {
  total: number;
  entries: TmdbUniverseEntry[];
}

/**
 * Every title in a universe, in release order. Cached per universe because the
 * roster is shared by all of its detail pages and changes rarely.
 */
async function loadUniverseRoster(
  universe: TmdbUniverseDefinition,
): Promise<UniverseRoster> {
  const key = `tmdb:universe:v2:${universe.id}`;
  const cached = await readTmdbCache<UniverseRoster>(key);
  if (cached) return cached;

  const path = universe.kind === "movie" ? "/discover/movie" : "/discover/tv";
  const entries: TmdbUniverseEntry[] = [];
  let total = 0;

  for (let page = 1; page <= UNIVERSE_MAX_PAGES; page += 1) {
    const payload = await tmdbGet<unknown>(path, {
      query: {
        language: "en-US",
        page,
        sort_by: `${universe.sortField}.asc`,
        with_keywords: universe.keywordId,
      },
      revalidateSeconds: 86400,
    });
    const mapped = mapSearchPage(universe.kind, payload);
    total = mapped.totalResults;
    if (mapped.results.length === 0) break;

    entries.push(
      ...mapped.results
        .map((item) => ({
          tmdbId: item.tmdbId,
          title: item.title,
          posterUrl: item.posterUrl,
          releaseDate: item.releaseDate,
          year: item.year,
          voteAverage: item.voteAverage,
        }))
        .filter((entry) => isListableUniverseEntry(entry, universe)),
    );

    if (page * UNIVERSE_PAGE_SIZE >= total) break;
  }

  const roster: UniverseRoster = { total: entries.length, entries };
  await writeTmdbCache(key, roster);
  return roster;
}

async function getTmdbUniverse(
  kind: TmdbKind,
  tmdbId: number,
  keywordIds: readonly number[],
): Promise<TmdbUniverse | null> {
  const definition = matchTmdbUniverse(kind, keywordIds);
  if (!definition) return null;

  try {
    const roster = await loadUniverseRoster(definition);
    return buildTmdbUniverse(definition, roster, tmdbId);
  } catch {
    // Watch order is contextual navigation; the detail page stays usable.
    return null;
  }
}

export async function getTmdbDetails(
  kind: TmdbKind,
  tmdbId: number,
): Promise<TmdbDetails> {
  // The version suffix prevents older cached payloads without credits,
  // recommendations or collections from reaching the shared detail view.
  const key = `tmdb:details:v4:${kind}:${tmdbId}`;
  const cached = await readTmdbCache<TmdbDetails>(key);
  if (cached) return cached;

  const path = kind === "movie" ? `/movie/${tmdbId}` : `/tv/${tmdbId}`;
  const payload = await tmdbGet<unknown>(path, {
    query: {
      language: "en-US",
      append_to_response:
        "external_ids,credits,recommendations,belongs_to_collection,videos,keywords",
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

  const universe = await getTmdbUniverse(kind, tmdbId, details.keywordIds ?? []);
  if (universe) details = { ...details, universe };

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
