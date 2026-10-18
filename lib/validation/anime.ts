import { z } from "zod";

import {
  ANIME_FORMATS,
  ANIME_SEASONS,
  type AnimeSearchParams,
  type AnimeSort,
} from "@/types/anime";

export const ANIME_SORTS = [
  "POPULARITY_DESC",
  "SCORE_DESC",
  "TRENDING_DESC",
  "START_DATE_DESC",
  "TITLE_ROMAJI",
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
  season: optionalEnum(ANIME_SEASONS),
  seasonYear: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().min(1940).max(2100).optional(),
  ),
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
    season: get("season"),
    seasonYear: get("year"),
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
    season: input.season,
    seasonYear: input.seasonYear,
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
  if (input.season) params.set("season", input.season);
  if (input.seasonYear) params.set("year", String(input.seasonYear));
  if (input.sort) params.set("sort", input.sort);
  if (options.includePaging) {
    if (input.page > 1) params.set("page", String(input.page));
    if (input.perPage !== DEFAULT_PER_PAGE) {
      params.set("perPage", String(input.perPage));
    }
  }
  return params;
}
