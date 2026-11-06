import { z } from "zod";

import { TmdbValidationError } from "@/services/tmdb/errors";
import type {
  TmdbDetails,
  TmdbEpisode,
  TmdbKind,
  TmdbSearchPage,
  TmdbSeasonDetails,
  TmdbSeasonSummary,
} from "@/types/tmdb";

const IMAGE_BASE = "https://image.tmdb.org/t/p";

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();

function image(path: string | null | undefined, size: string): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${IMAGE_BASE}/${size}${path}`;
}

function yearFromDate(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(value);
  return match ? Number(match[1]) : null;
}

const searchItemSchema = z.object({
  id: z.number().int().positive(),
  title: nullableString,
  name: nullableString,
  original_title: nullableString,
  original_name: nullableString,
  overview: nullableString,
  poster_path: nullableString,
  backdrop_path: nullableString,
  release_date: nullableString,
  first_air_date: nullableString,
  vote_average: nullableNumber,
  vote_count: nullableNumber,
});

const searchPageSchema = z.object({
  page: z.number().int().nonnegative(),
  total_pages: z.number().int().nonnegative(),
  total_results: z.number().int().nonnegative(),
  results: z.array(searchItemSchema),
});

const genreSchema = z.object({
  id: z.number().int(),
  name: z.string(),
});

const seasonSchema = z.object({
  season_number: z.number().int().nonnegative(),
  name: z.string().optional(),
  episode_count: z.number().int().nonnegative().optional(),
  air_date: nullableString,
  poster_path: nullableString,
  overview: nullableString,
});

const detailsSchema = z.object({
  id: z.number().int().positive(),
  title: nullableString,
  name: nullableString,
  original_title: nullableString,
  original_name: nullableString,
  overview: nullableString,
  tagline: nullableString,
  poster_path: nullableString,
  backdrop_path: nullableString,
  release_date: nullableString,
  first_air_date: nullableString,
  genres: z.array(genreSchema).optional(),
  runtime: nullableNumber,
  episode_run_time: z.array(z.number()).optional(),
  number_of_seasons: nullableNumber,
  number_of_episodes: nullableNumber,
  status: nullableString,
  vote_average: nullableNumber,
  vote_count: nullableNumber,
  seasons: z.array(seasonSchema).optional(),
});

const episodeSchema = z.object({
  episode_number: z.number().int().positive(),
  name: z.string().optional(),
  overview: nullableString,
  air_date: nullableString,
  runtime: nullableNumber,
  still_path: nullableString,
  vote_average: nullableNumber,
});

const seasonDetailsSchema = z.object({
  season_number: z.number().int().nonnegative(),
  name: z.string().optional(),
  overview: nullableString,
  air_date: nullableString,
  poster_path: nullableString,
  episodes: z.array(episodeSchema).optional(),
});

function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new TmdbValidationError();
  }
  return result.data;
}

export function mapSearchPage(
  kind: TmdbKind,
  payload: unknown,
): TmdbSearchPage {
  const parsed = parse(searchPageSchema, payload);
  return {
    page: parsed.page,
    totalPages: parsed.total_pages,
    totalResults: parsed.total_results,
    results: parsed.results.flatMap((item) => {
      const title = kind === "movie" ? item.title : item.name;
      if (!title) return [];
      const date = kind === "movie" ? item.release_date : item.first_air_date;
      return [
        {
          tmdbId: item.id,
          kind,
          title,
          originalTitle:
            (kind === "movie" ? item.original_title : item.original_name) ??
            null,
          overview: item.overview ?? null,
          posterUrl: image(item.poster_path, "w500"),
          backdropUrl: image(item.backdrop_path, "w1280"),
          releaseDate: date ?? null,
          year: yearFromDate(date),
          voteAverage: item.vote_average ?? null,
          voteCount: item.vote_count ?? null,
        },
      ];
    }),
  };
}

export function mapDetails(kind: TmdbKind, payload: unknown): TmdbDetails {
  const parsed = parse(detailsSchema, payload);
  const title = kind === "movie" ? parsed.title : parsed.name;
  if (!title) {
    throw new TmdbValidationError("TMDB returned a title without a name.");
  }
  const date =
    kind === "movie" ? parsed.release_date : parsed.first_air_date;

  return {
    tmdbId: parsed.id,
    kind,
    title,
    originalTitle:
      (kind === "movie" ? parsed.original_title : parsed.original_name) ?? null,
    overview: parsed.overview ?? null,
    tagline: parsed.tagline ?? null,
    posterUrl: image(parsed.poster_path, "w500"),
    backdropUrl: image(parsed.backdrop_path, "w1280"),
    releaseDate: date ?? null,
    year: yearFromDate(date),
    genres: (parsed.genres ?? []).map((genre) => genre.name),
    runtime: parsed.runtime ?? null,
    episodeRuntime: parsed.episode_run_time ?? [],
    numberOfSeasons: parsed.number_of_seasons ?? null,
    numberOfEpisodes: parsed.number_of_episodes ?? null,
    status: parsed.status ?? null,
    voteAverage: parsed.vote_average ?? null,
    voteCount: parsed.vote_count ?? null,
    seasons: (parsed.seasons ?? [])
      .filter((season) => season.season_number >= 0)
      .map<TmdbSeasonSummary>((season) => ({
        seasonNumber: season.season_number,
        name: season.name || `Season ${season.season_number}`,
        episodeCount: season.episode_count ?? 0,
        airDate: season.air_date ?? null,
        posterUrl: image(season.poster_path, "w342"),
        overview: season.overview ?? null,
      })),
  };
}

export function mapSeason(
  tmdbId: number,
  payload: unknown,
): TmdbSeasonDetails {
  const parsed = parse(seasonDetailsSchema, payload);
  return {
    tmdbId,
    seasonNumber: parsed.season_number,
    name: parsed.name || `Season ${parsed.season_number}`,
    overview: parsed.overview ?? null,
    airDate: parsed.air_date ?? null,
    posterUrl: image(parsed.poster_path, "w342"),
    episodes: (parsed.episodes ?? []).map<TmdbEpisode>((episode) => ({
      seasonNumber: parsed.season_number,
      episodeNumber: episode.episode_number,
      name: episode.name || `Episode ${episode.episode_number}`,
      overview: episode.overview ?? null,
      airDate: episode.air_date ?? null,
      runtime: episode.runtime ?? null,
      stillUrl: image(episode.still_path, "w300"),
      voteAverage: episode.vote_average ?? null,
    })),
  };
}
