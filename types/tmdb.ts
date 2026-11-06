import type { WatchStatus } from "@/types/library";

export const TMDB_KINDS = ["movie", "tv"] as const;

export type TmdbKind = (typeof TMDB_KINDS)[number];

export function isTmdbKind(value: unknown): value is TmdbKind {
  return value === "movie" || value === "tv";
}

export const TMDB_MOVIE_DISCOVER_CATEGORIES = [
  "trending",
  "popular",
  "top_rated",
  "upcoming",
] as const;

export const TMDB_TV_DISCOVER_CATEGORIES = [
  "trending",
  "popular",
  "top_rated",
  "on_the_air",
] as const;

export type TmdbMovieDiscoverCategory =
  (typeof TMDB_MOVIE_DISCOVER_CATEGORIES)[number];
export type TmdbTvDiscoverCategory =
  (typeof TMDB_TV_DISCOVER_CATEGORIES)[number];
export type TmdbDiscoverCategory =
  | TmdbMovieDiscoverCategory
  | TmdbTvDiscoverCategory;

export function tmdbDiscoverCategoriesForKind(
  kind: TmdbKind,
): readonly TmdbDiscoverCategory[] {
  return kind === "movie"
    ? TMDB_MOVIE_DISCOVER_CATEGORIES
    : TMDB_TV_DISCOVER_CATEGORIES;
}

export interface TmdbSearchResult {
  tmdbId: number;
  kind: TmdbKind;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  year: number | null;
  voteAverage: number | null;
  voteCount: number | null;
}

export interface TmdbSearchPage {
  page: number;
  totalPages: number;
  totalResults: number;
  results: TmdbSearchResult[];
}

export interface TmdbSeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterUrl: string | null;
  overview: string | null;
}

export interface TmdbEpisode {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string | null;
  airDate: string | null;
  runtime: number | null;
  stillUrl: string | null;
  voteAverage: number | null;
}

export interface TmdbSeasonDetails {
  tmdbId: number;
  seasonNumber: number;
  name: string;
  overview: string | null;
  airDate: string | null;
  posterUrl: string | null;
  episodes: TmdbEpisode[];
}

export interface TmdbCastMember {
  id: number;
  name: string;
  character: string | null;
  profileUrl: string | null;
  order: number | null;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string | null;
  department: string | null;
  profileUrl: string | null;
}

export interface TmdbCollectionPart {
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  releaseDate: string | null;
  year: number | null;
  voteAverage: number | null;
  overview: string | null;
}

export interface TmdbCollection {
  id: number;
  name: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  parts: TmdbCollectionPart[];
}

export interface TmdbRecommendation {
  tmdbId: number;
  kind: TmdbKind;
  title: string;
  posterUrl: string | null;
  year: number | null;
  voteAverage: number | null;
}

export interface TmdbTrailer {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
}

export interface TmdbDetails {
  tmdbId: number;
  kind: TmdbKind;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  tagline: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  year: number | null;
  genres: string[];
  runtime: number | null;
  episodeRuntime: number[];
  numberOfSeasons: number | null;
  numberOfEpisodes: number | null;
  status: string | null;
  voteAverage: number | null;
  voteCount: number | null;
  adult: boolean;
  productionCompanies: string[];
  networks: string[];
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
  recommendations: TmdbRecommendation[];
  trailer: TmdbTrailer | null;
  collection: TmdbCollection | null;
  seasons: TmdbSeasonSummary[];
}

/** A persisted movie/TV library row. */
export interface TmdbLibraryEntry {
  id: string;
  userId: string;
  tmdbId: number;
  mediaType: TmdbKind;
  title: string;
  originalTitle: string | null;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  status: WatchStatus;
  score: number | null;
  notes: string | null;
  watched: boolean;
  totalEpisodes: number | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TmdbWatchedEpisode {
  id: string;
  entryId: string;
  userId: string;
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: string;
}

export interface TmdbLibraryItem {
  entry: TmdbLibraryEntry;
  watchedEpisodes: TmdbWatchedEpisode[];
  /** Convenience count used by library cards. */
  watchedCount: number;
}
