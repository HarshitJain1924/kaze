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

export interface TmdbFilterOption {
  value: string;
  label: string;
}

/** TMDB genre ids are stable catalogue constants, not discovery results. */
export const TMDB_MOVIE_GENRES: TmdbFilterOption[] = [
  { value: "28", label: "Action" },
  { value: "12", label: "Adventure" },
  { value: "16", label: "Animation" },
  { value: "35", label: "Comedy" },
  { value: "80", label: "Crime" },
  { value: "99", label: "Documentary" },
  { value: "18", label: "Drama" },
  { value: "10751", label: "Family" },
  { value: "14", label: "Fantasy" },
  { value: "36", label: "History" },
  { value: "27", label: "Horror" },
  { value: "10402", label: "Music" },
  { value: "9648", label: "Mystery" },
  { value: "10749", label: "Romance" },
  { value: "878", label: "Science Fiction" },
  { value: "53", label: "Thriller" },
  { value: "10752", label: "War" },
  { value: "37", label: "Western" },
];

export const TMDB_TV_GENRES: TmdbFilterOption[] = [
  { value: "10759", label: "Action & Adventure" },
  { value: "16", label: "Animation" },
  { value: "35", label: "Comedy" },
  { value: "80", label: "Crime" },
  { value: "99", label: "Documentary" },
  { value: "18", label: "Drama" },
  { value: "10751", label: "Family" },
  { value: "10762", label: "Kids" },
  { value: "9648", label: "Mystery" },
  { value: "10763", label: "News" },
  { value: "10764", label: "Reality" },
  { value: "10765", label: "Sci-Fi & Fantasy" },
  { value: "10766", label: "Soap" },
  { value: "10767", label: "Talk" },
  { value: "10768", label: "War & Politics" },
  { value: "37", label: "Western" },
];

export const TMDB_DISCOVER_SORTS = [
  "popularity.desc",
  "vote_average.desc",
  "vote_count.desc",
  "primary_release_date.desc",
  "primary_release_date.asc",
  "first_air_date.desc",
  "first_air_date.asc",
  "original_title.asc",
  "name.asc",
] as const;

export type TmdbDiscoverSort = (typeof TMDB_DISCOVER_SORTS)[number];

export const TMDB_RATING_FILTERS: TmdbFilterOption[] = [
  { value: "", label: "Any rating" },
  { value: "6", label: "6.0+" },
  { value: "7", label: "7.0+" },
  { value: "8", label: "8.0+" },
  { value: "9", label: "9.0+" },
];

export function tmdbGenresForKind(kind: TmdbKind): TmdbFilterOption[] {
  return kind === "movie" ? TMDB_MOVIE_GENRES : TMDB_TV_GENRES;
}

export function tmdbSortsForKind(kind: TmdbKind): TmdbFilterOption[] {
  return kind === "movie"
    ? [
        { value: "popularity.desc", label: "Popularity" },
        { value: "vote_average.desc", label: "Rating" },
        { value: "vote_count.desc", label: "Most rated" },
        { value: "primary_release_date.desc", label: "Newest" },
        { value: "primary_release_date.asc", label: "Oldest" },
        { value: "original_title.asc", label: "Title A–Z" },
      ]
    : [
        { value: "popularity.desc", label: "Popularity" },
        { value: "vote_average.desc", label: "Rating" },
        { value: "vote_count.desc", label: "Most rated" },
        { value: "first_air_date.desc", label: "Newest" },
        { value: "first_air_date.asc", label: "Oldest" },
        { value: "name.asc", label: "Title A–Z" },
      ];
}

export function isTmdbSortForKind(
  kind: TmdbKind,
  sort: string,
): sort is TmdbDiscoverSort {
  return tmdbSortsForKind(kind).some((option) => option.value === sort);
}

/** Keeps a genre selection to the ids that exist in the kind's catalogue. */
export function tmdbGenreIdsForKind(kind: TmdbKind): Set<string> {
  return new Set(tmdbGenresForKind(kind).map((option) => option.value));
}

/** Optional constraints layered on top of a discovery category. */
export interface TmdbDiscoverFilters {
  /**
   * TMDB genre ids. Several ids match titles carrying any of those genres,
   * matching the pipe-separated `with_genres` OR query.
   */
  genres?: string[];
  year?: number;
  minRating?: number;
  sort?: TmdbDiscoverSort;
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

/** One dated movie release or TV airing in the weekly screen calendar. */
export interface ScreenScheduleEntry {
  tmdbId: number;
  kind: TmdbKind;
  title: string;
  posterUrl: string | null;
  year: number | null;
  voteAverage: number | null;
  /** "YYYY-MM-DD" the release or airing belongs to. */
  date: string;
}

export interface TmdbUniverseEntry {
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  releaseDate: string | null;
  year: number | null;
  voteAverage: number | null;
}

/** A shared film/series universe (MCU, Star Wars, DC) with release ordering. */
export interface TmdbUniverse {
  id: string;
  label: string;
  shortLabel: string;
  /** Number of titles the source reports for the universe. */
  total: number;
  /** 1-based release-order position of the current title, when listed. */
  position: number | null;
  entries: TmdbUniverseEntry[];
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
  /** TMDB keyword ids, used to detect shared universes. */
  keywordIds?: number[];
  networks: string[];
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
  recommendations: TmdbRecommendation[];
  trailer: TmdbTrailer | null;
  collection: TmdbCollection | null;
  /** Present when the title belongs to a known shared universe. */
  universe?: TmdbUniverse | null;
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
