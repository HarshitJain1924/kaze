import type { Metadata } from "next";

import type { AnimeFilterState } from "@/components/anime-filters";
import { DiscoverBrowser } from "@/features/anime/discover-browser";
import { getViewer } from "@/lib/auth";
import {
  animeSearchParamsSchema,
  toAnimeSearchParams,
  type AnimeSearchInput,
} from "@/lib/validation/anime";
import { getCatalogService } from "@/services/catalog/catalog-service";
import {
  TmdbNotConfiguredError,
  TmdbRateLimitError,
} from "@/services/tmdb/errors";
import { discoverTmdb, searchTmdb } from "@/services/tmdb/service";
import type { AnimePage } from "@/types/anime";
import type { DiscoverView } from "@/types/discover";
import {
  isTmdbSortForKind,
  tmdbDiscoverCategoriesForKind,
  tmdbGenresForKind,
  type TmdbDiscoverCategory,
  type TmdbDiscoverFilters,
  type TmdbKind,
  type TmdbSearchPage,
} from "@/types/tmdb";

export const metadata: Metadata = {
  title: "Discover anime, manga, movies & TV",
  description:
    "Search and filter anime, manga and manhwa, or browse and search movies and TV shows, all from one Kaze discovery page.",
};

function readInput(
  params: Record<string, string | string[] | undefined>,
): AnimeSearchInput {
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const parsed = animeSearchParamsSchema.safeParse({
    query: pick("q"),
    type: pick("type"),
    genre: pick("genre"),
    format: pick("format"),
    status: pick("status"),
    season: pick("season"),
    seasonYear: pick("year"),
    source: pick("source"),
    countryOfOrigin: pick("country"),
    adult: pick("adult"),
    sort: pick("sort"),
    page: 1,
    perPage: 24,
  });

  if (parsed.success) {
    return parsed.data;
  }

  return animeSearchParamsSchema.parse({ page: 1, perPage: 24 });
}

function readView(
  params: Record<string, string | string[] | undefined>,
): DiscoverView {
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const type = pick("type");
  if (type === "movie" || type === "tv") return type;
  if (type === "manga") return pick("country") === "KR" ? "manhwa" : "manga";
  return "anime";
}

function readCategory(
  kind: TmdbKind,
  params: Record<string, string | string[] | undefined>,
): TmdbDiscoverCategory {
  const value = params.category;
  const requested = Array.isArray(value) ? value[0] : value;
  const categories = tmdbDiscoverCategoriesForKind(kind);
  return categories.includes(requested as TmdbDiscoverCategory)
    ? (requested as TmdbDiscoverCategory)
    : "trending";
}

function readTmdbFilters(
  kind: TmdbKind,
  params: Record<string, string | string[] | undefined>,
): TmdbDiscoverFilters {
  const pick = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const filters: TmdbDiscoverFilters = {};

  const genre = pick("genre");
  if (genre && tmdbGenresForKind(kind).some((item) => item.value === genre)) {
    filters.genre = genre;
  }

  const year = Number(pick("year"));
  if (Number.isInteger(year) && year >= 1900 && year <= 2100) {
    filters.year = year;
  }

  const rating = Number(pick("rating"));
  if (Number.isFinite(rating) && rating > 0 && rating <= 10) {
    filters.minRating = rating;
  }

  const sort = pick("sort");
  if (sort && isTmdbSortForKind(kind, sort)) {
    filters.sort = sort;
  }

  return filters;
}

function tmdbFailureMessage(error: unknown): string {
  if (error instanceof TmdbNotConfiguredError) return error.message;
  if (error instanceof TmdbRateLimitError) return error.message;
  return "TMDB discovery is temporarily unavailable. Try again in a moment.";
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const initialView = readView(params);
  const input = readInput(params);
  const viewer = await getViewer();
  const isTmdbView = initialView === "movie" || initialView === "tv";

  let initialPage: AnimePage | null = null;
  if (!isTmdbView) {
    try {
      const result = await getCatalogService().searchMedia(
        toAnimeSearchParams(input),
      );
      initialPage = result.data;
    } catch (error) {
      console.error(
        "[discover] initial catalogue search failed:",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }

  let initialTmdbPage: TmdbSearchPage | null = null;
  let initialTmdbError: string | null = null;
  let initialTmdbCategory: TmdbDiscoverCategory = "trending";
  let initialTmdbQuery = "";
  let initialTmdbFilters: TmdbDiscoverFilters = {};

  if (isTmdbView) {
    const kind = initialView as TmdbKind;
    const rawQuery = params.q;
    const query = Array.isArray(rawQuery) ? rawQuery[0] : rawQuery;
    initialTmdbCategory = readCategory(kind, params);
    initialTmdbQuery = query?.trim().slice(0, 100) ?? "";
    initialTmdbFilters = readTmdbFilters(kind, params);
    try {
      initialTmdbPage =
        initialTmdbQuery.length >= 2
          ? await searchTmdb(kind, initialTmdbQuery, 1)
          : await discoverTmdb(
              kind,
              initialTmdbCategory,
              1,
              initialTmdbFilters,
            );
    } catch (error) {
      initialTmdbError = tmdbFailureMessage(error);
      console.error(
        "[discover] initial TMDB discovery failed:",
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }

  const initialFilters: AnimeFilterState = {
    mediaType: input.type ?? "anime",
    genre: input.genre,
    format: input.format,
    status: input.status,
    season: input.season,
    year: input.seasonYear,
    source: input.source,
    countryOfOrigin: input.countryOfOrigin,
    adultContent: input.adult,
    sort: input.sort ?? "POPULARITY_DESC",
  };

  return (
    <DiscoverBrowser
      initialPage={initialPage}
      initialQuery={input.query ?? ""}
      initialFilters={initialFilters}
      initialView={initialView}
      initialTmdbPage={initialTmdbPage}
      initialTmdbCategory={initialTmdbCategory}
      initialTmdbQuery={initialTmdbQuery}
      initialTmdbFilters={initialTmdbFilters}
      initialTmdbError={initialTmdbError}
      adultAllowed={viewer?.showAdult === true}
    />
  );
}
