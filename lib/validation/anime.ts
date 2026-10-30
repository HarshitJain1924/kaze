import { z } from "zod";

import {
  ANIME_COUNTRIES,
  ANIME_FORMATS,
  ANIME_RELEASE_STATUSES,
  ANIME_SEASONS,
  ANIME_SOURCES,
  type AnimeSearchParams,
  type AnimeSort,
} from "@/types/anime";

export const ANIME_SORTS = [
  "POPULARITY_DESC",
  "SCORE_DESC",
  "TRENDING_DESC",
  "FAVOURITES_DESC",
  "START_DATE_DESC",
  "START_DATE",
  "TITLE_ROMAJI",
  "TITLE_ROMAJI_DESC",
] as const satisfies readonly AnimeSort[];

export const MAX_SEARCH_LENGTH = 120;
export const MAX_PAGE = 500;
export const DEFAULT_PER_PAGE = 24;
export const MAX_PER_PAGE = 50;

const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = (max: number) =>
  z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .max(max, `Must be ${max} characters or fewer`)
      .optional(),
  );

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(blankToUndefined, z.enum(values).optional());

/**
 * Validates user-facing search/filter input from either a URL or a
 * client payload before it reaches the AniList service.
 */
export const animeSearchParamsSchema = z.object({
  query: optionalText(MAX_SEARCH_LENGTH),
  genre: optionalText(40),
  format: optionalEnum(ANIME_FORMATS),
  status: optionalEnum(ANIME_RELEASE_STATUSES),
  season: optionalEnum(ANIME_SEASONS),
  seasonYear: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(1940).max(2100).optional(),
  ),
  source: optionalEnum(ANIME_SOURCES),
  countryOfOrigin: optionalEnum(ANIME_COUNTRIES),
  sort: optionalEnum(ANIME_SORTS),
  page: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  ),
  perPage: z.preprocess(
    blankToUndefined,
    z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PER_PAGE)
      .default(DEFAULT_PER_PAGE),
  ),
});

export type AnimeSearchInput = z.infer<typeof animeSearchParamsSchema>;

/** Reads filters from a URLSearchParams instance. */
export function parseAnimeSearchParams(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
): AnimeSearchInput {
  const get = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) ?? undefined;
    }
    const value = searchParams[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return animeSearchParamsSchema.parse({
    query: get("q"),
    genre: get("genre"),
    format: get("format"),
    status: get("status"),
    season: get("season"),
    seasonYear: get("year"),
    source: get("source"),
    countryOfOrigin: get("country"),
    sort: get("sort"),
    page: get("page"),
    perPage: get("perPage"),
  });
}

export function toAnimeSearchParams(
  input: AnimeSearchInput,
): AnimeSearchParams {
  return {
    query: input.query || undefined,
    genre: input.genre || undefined,
    format: input.format,
    status: input.status,
    season: input.season,
    seasonYear: input.seasonYear,
    source: input.source,
    countryOfOrigin: input.countryOfOrigin,
    sort: input.sort,
    page: input.page,
    perPage: input.perPage,
  };
}

/** Serializes filters for the discover URL and client fetches. */
export function serializeAnimeSearchParams(
  input: AnimeSearchInput,
  options: { includePaging?: boolean } = {},
): URLSearchParams {
  const params = new URLSearchParams();
  if (input.query) params.set("q", input.query);
  if (input.genre) params.set("genre", input.genre);
  if (input.format) params.set("format", input.format);
  if (input.status) params.set("status", input.status);
  if (input.season) params.set("season", input.season);
  if (input.seasonYear) params.set("year", String(input.seasonYear));
  if (input.source) params.set("source", input.source);
  if (input.countryOfOrigin) params.set("country", input.countryOfOrigin);
  if (input.sort) params.set("sort", input.sort);
  if (options.includePaging) {
    if (input.page > 1) params.set("page", String(input.page));
    if (input.perPage !== DEFAULT_PER_PAGE) {
      params.set("perPage", String(input.perPage));
    }
  }
  return params;
}
