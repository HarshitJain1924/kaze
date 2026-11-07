import { z } from "zod";

import { TmdbValidationError } from "@/services/tmdb/errors";
import type {
  TmdbCastMember,
  TmdbCollection,
  TmdbCrewMember,
  TmdbDetails,
  TmdbEpisode,
  TmdbKind,
  TmdbRecommendation,
  TmdbSearchPage,
  TmdbSeasonDetails,
  TmdbSeasonSummary,
  TmdbTrailer,
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
  adult: z.boolean().optional(),
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

const namedEntitySchema = z.object({
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

const castSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  character: nullableString,
  profile_path: nullableString,
  order: nullableNumber,
});

const crewSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  job: nullableString,
  department: nullableString,
  profile_path: nullableString,
});

const collectionPartSchema = z.object({
  id: z.number().int().positive(),
  title: nullableString,
  poster_path: nullableString,
  release_date: nullableString,
  vote_average: nullableNumber,
  overview: nullableString,
});

const collectionSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  poster_path: nullableString,
  backdrop_path: nullableString,
  parts: z.array(collectionPartSchema).optional(),
});

const collectionRefSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  poster_path: nullableString,
  backdrop_path: nullableString,
});

const videoSchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  site: z.string(),
  type: z.string(),
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
  adult: z.boolean().optional(),
  production_companies: z.array(namedEntitySchema).optional(),
  networks: z.array(namedEntitySchema).optional(),
  created_by: z.array(namedEntitySchema).optional(),
  credits: z
    .object({
      cast: z.array(castSchema).optional(),
      crew: z.array(crewSchema).optional(),
    })
    .optional(),
  recommendations: z
    .object({
      results: z.array(searchItemSchema).optional(),
    })
    .optional(),
  videos: z
    .object({
      results: z.array(videoSchema).optional(),
    })
    .optional(),
  belongs_to_collection: collectionRefSchema.nullable().optional(),
  seasons: z.array(seasonSchema).optional(),
  // Movies return `keywords.keywords`, series return `keywords.results`.
  keywords: z
    .object({
      keywords: z.array(z.object({ id: z.number().int() })).optional(),
      results: z.array(z.object({ id: z.number().int() })).optional(),
    })
    .optional(),
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

function mapRecommendation(
  kind: TmdbKind,
  item: z.infer<typeof searchItemSchema>,
): TmdbRecommendation | null {
  const title = kind === "movie" ? item.title : item.name;
  if (!title) return null;
  const date = kind === "movie" ? item.release_date : item.first_air_date;
  return {
    tmdbId: item.id,
    kind,
    title,
    posterUrl: image(item.poster_path, "w342"),
    year: yearFromDate(date),
    voteAverage: item.vote_average ?? null,
  };
}

function pickTrailer(videos: z.infer<typeof videoSchema>[]): TmdbTrailer | null {
  const youtube = videos.filter(
    (video) => video.site.toLowerCase() === "youtube" && video.key,
  );
  const selected =
    youtube.find((video) => video.type.toLowerCase() === "trailer") ??
    youtube.find((video) => video.type.toLowerCase() === "teaser") ??
    youtube[0];

  if (!selected) return null;
  return {
    id: selected.id,
    key: selected.key,
    name: selected.name,
    site: selected.site,
    type: selected.type,
  };
}

function mapCast(
  cast: z.infer<typeof castSchema>[],
): TmdbCastMember[] {
  return cast
    .map((member) => ({
      id: member.id,
      name: member.name,
      character: member.character ?? null,
      profileUrl: image(member.profile_path, "w185"),
      order: member.order ?? null,
    }))
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
}

function mapCrew(
  crew: z.infer<typeof crewSchema>[],
  createdBy: z.infer<typeof namedEntitySchema>[],
): TmdbCrewMember[] {
  const people = new Map<string, TmdbCrewMember>();

  for (const creator of createdBy) {
    people.set(`${creator.id}:Creator`, {
      id: creator.id,
      name: creator.name,
      job: "Creator",
      department: "Production",
      profileUrl: null,
    });
  }

  for (const member of crew) {
    const job = member.job ?? null;
    if (!job) continue;
    people.set(`${member.id}:${job}`, {
      id: member.id,
      name: member.name,
      job,
      department: member.department ?? null,
      profileUrl: image(member.profile_path, "w185"),
    });
  }

  return [...people.values()];
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
          adult: item.adult ?? false,
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
    adult: parsed.adult ?? false,
    productionCompanies: (parsed.production_companies ?? []).map(
      (company) => company.name,
    ),
    keywordIds: [
      ...(parsed.keywords?.keywords ?? []),
      ...(parsed.keywords?.results ?? []),
    ].map((keyword) => keyword.id),
    networks: (parsed.networks ?? []).map((network) => network.name),
    cast: mapCast(parsed.credits?.cast ?? []),
    crew: mapCrew(
      parsed.credits?.crew ?? [],
      parsed.created_by ?? [],
    ),
    recommendations: (parsed.recommendations?.results ?? []).flatMap(
      (item) => {
        const recommendation = mapRecommendation(kind, item);
        return recommendation ? [recommendation] : [];
      },
    ),
    trailer: pickTrailer(parsed.videos?.results ?? []),
    collection: parsed.belongs_to_collection
      ? {
          id: parsed.belongs_to_collection.id,
          name: parsed.belongs_to_collection.name,
          posterUrl: image(
            parsed.belongs_to_collection.poster_path,
            "w342",
          ),
          backdropUrl: image(
            parsed.belongs_to_collection.backdrop_path,
            "w1280",
          ),
          parts: [],
        }
      : null,
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

export function mapCollection(payload: unknown): TmdbCollection {
  const parsed = parse(collectionSchema, payload);
  return {
    id: parsed.id,
    name: parsed.name,
    posterUrl: image(parsed.poster_path, "w342"),
    backdropUrl: image(parsed.backdrop_path, "w1280"),
    parts: (parsed.parts ?? []).flatMap((part) => {
      if (!part.title) return [];
      const date = part.release_date ?? null;
      return [
        {
          tmdbId: part.id,
          title: part.title,
          posterUrl: image(part.poster_path, "w342"),
          releaseDate: date,
          year: yearFromDate(date),
          voteAverage: part.vote_average ?? null,
          overview: part.overview ?? null,
        },
      ];
    }),
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
