import type { TmdbAdultFilter, TmdbSearchPage } from "@/types/tmdb";

/**
 * TMDB's search and discover endpoints only take a boolean adult flag, so an
 * adult-only view keeps the flagged titles from a page that already includes
 * them. Everything else passes through untouched.
 */
export function applyAdultMode(
  page: TmdbSearchPage,
  adult: TmdbAdultFilter | undefined,
): TmdbSearchPage {
  if (adult !== "only") return page;

  return {
    ...page,
    results: page.results.filter((item) => item.adult === true),
  };
}
