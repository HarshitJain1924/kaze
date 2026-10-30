import type { Metadata } from "next";

import type { AnimeFilterState } from "@/components/anime-filters";
import { DiscoverBrowser } from "@/features/anime/discover-browser";
import {
  animeSearchParamsSchema,
  toAnimeSearchParams,
  type AnimeSearchInput,
} from "@/lib/validation/anime";
import { getCatalogService } from "@/services/catalog/catalog-service";
import type { AnimePage } from "@/types/anime";

export const metadata: Metadata = {
  title: "Discover anime",
  description:
    "Search and filter thousands of anime by title, genre, format, airing status, season, year, source material and country.",
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
    genre: pick("genre"),
    format: pick("format"),
    status: pick("status"),
    season: pick("season"),
    seasonYear: pick("year"),
    source: pick("source"),
    countryOfOrigin: pick("country"),
    sort: pick("sort"),
    page: 1,
    perPage: 24,
  });

  if (parsed.success) {
    return parsed.data;
  }

  return animeSearchParamsSchema.parse({ page: 1, perPage: 24 });
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const input = readInput(params);

  let initialPage: AnimePage | null = null;
  try {
    const result = await getCatalogService().searchAnime(
      toAnimeSearchParams(input),
    );
    initialPage = result.data;
  } catch (error) {
    console.error(
      "[discover] initial catalogue search failed:",
      error instanceof Error ? error.message : "unknown error",
    );
  }

  const initialFilters: AnimeFilterState = {
    genre: input.genre,
    format: input.format,
    status: input.status,
    season: input.season,
    year: input.seasonYear,
    source: input.source,
    countryOfOrigin: input.countryOfOrigin,
    sort: input.sort ?? "POPULARITY_DESC",
  };

  return (
    <DiscoverBrowser
      initialPage={initialPage}
      initialQuery={input.query ?? ""}
      initialFilters={initialFilters}
    />
  );
}
