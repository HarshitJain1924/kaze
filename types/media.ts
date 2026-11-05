import type { AnimeSummary, RelatedAnime } from "@/types/anime";
import type { WatchStatus } from "@/types/library";

/**
 * The four media kinds Kaze is growing to support.
 *
 * This is deliberately separate from the legacy `MediaType` in `types/anime`,
 * which only represents AniList's anime/manga split. Existing routes and
 * repositories continue to use that legacy type until the database migration.
 */
export const MEDIA_KINDS = ["anime", "manga", "movie", "tv"] as const;

export type MediaKind = (typeof MEDIA_KINDS)[number];

export function isMediaKind(value: unknown): value is MediaKind {
  return (
    typeof value === "string" &&
    (MEDIA_KINDS as readonly string[]).includes(value)
  );
}

/**
 * Providers that may be associated with a canonical media record.
 *
 * A provider ID is never a Kaze identity. It is an external reference attached
 * to a `CanonicalMediaId`.
 */
export const MEDIA_PROVIDERS = [
  "anilist",
  "kitsu",
  "tmdb",
  "mal",
  "mangadex",
] as const;

export type MediaProvider = (typeof MEDIA_PROVIDERS)[number];

export function isMediaProvider(value: unknown): value is MediaProvider {
  return (
    typeof value === "string" &&
    (MEDIA_PROVIDERS as readonly string[]).includes(value)
  );
}

declare const canonicalMediaIdBrand: unique symbol;

/**
 * A UUID that identifies a row in the future canonical `media` table.
 *
 * The brand prevents a provider ID or a library-entry ID from being passed
 * where a canonical media identity is required.
 */
export type CanonicalMediaId = string & {
  readonly [canonicalMediaIdBrand]: true;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Normalizes and validates an external UUID before branding it. */
export function toCanonicalMediaId(value: string): CanonicalMediaId | null {
  const normalized = value.trim().toLowerCase();
  return UUID_PATTERN.test(normalized)
    ? (normalized as CanonicalMediaId)
    : null;
}

export function isCanonicalMediaId(
  value: unknown,
): value is CanonicalMediaId {
  if (typeof value !== "string") return false;
  const normalized = toCanonicalMediaId(value);
  return normalized === value;
}

/** A stable, normalized title set independent of any provider. */
export interface MediaTitles {
  /** Best display title selected by the adapter; a locale-aware UI may replace it. */
  primary: string;
  romaji: string | null;
  english: string | null;
  native: string | null;
}

export const MEDIA_ARTWORK_ROLES = [
  "poster",
  "backdrop",
  "banner",
  "logo",
] as const;

export type MediaArtworkRole = (typeof MEDIA_ARTWORK_ROLES)[number];

export function isMediaArtworkRole(
  value: unknown,
): value is MediaArtworkRole {
  return (
    typeof value === "string" &&
    (MEDIA_ARTWORK_ROLES as readonly string[]).includes(value)
  );
}

export interface MediaFocalPoint {
  /** Horizontal focal point in the range 0–1. */
  x: number;
  /** Vertical focal point in the range 0–1. */
  y: number;
}

/**
 * One provider-hosted image in one semantic role.
 *
 * Dimensions are nullable because not every provider reports them. Consumers
 * must choose a role-appropriate image instead of stretching a portrait poster
 * into a landscape slot.
 */
export interface MediaArtwork {
  role: MediaArtworkRole;
  url: string;
  provider: MediaProvider;
  width: number | null;
  height: number | null;
  aspectRatio: number | null;
  focalPoint: MediaFocalPoint | null;
  language: string | null;
  isPrimary: boolean;
  attribution: string | null;
}

/** A provider's identifier for a canonical media row. */
export interface MediaProviderRef {
  provider: MediaProvider;
  externalId: string;
  /** Optional public provider page, useful for attribution and debugging. */
  sourceUrl?: string | null;
}

/** Input for a provider mapping used by the legacy compatibility resolver. */
export interface MediaIdentityMapping {
  mediaId: CanonicalMediaId;
  provider: MediaProvider;
  externalId: string;
}

export interface MediaDate {
  year: number;
  month: number | null;
  day: number | null;
}

/**
 * Provider scores are normalized to a 0–100 scale at the boundary.
 * Personal user ratings remain a separate 1–10 value on library entries.
 */
export interface MediaCommunityRating {
  score: number;
  scale: number;
  provider: MediaProvider;
  count: number | null;
}

interface MediaSummaryCommon {
  id: CanonicalMediaId;
  title: MediaTitles;
  synopsis: string | null;
  artwork: MediaArtwork[];
  genres: string[];
  releaseYear: number | null;
  releaseStatus: string | null;
  format: string | null;
  communityRating: MediaCommunityRating | null;
  providerRefs: MediaProviderRef[];
  isAdult: boolean;
}

export interface AnimeMediaSummary extends MediaSummaryCommon {
  kind: "anime";
  episodes: number | null;
  countryOfOrigin: string | null;
}

export interface MangaMediaSummary extends MediaSummaryCommon {
  kind: "manga";
  chapters: number | null;
  volumes: number | null;
  countryOfOrigin: string | null;
}

export interface MovieMediaSummary extends MediaSummaryCommon {
  kind: "movie";
  runtimeMinutes: number | null;
}

export interface TvMediaSummary extends MediaSummaryCommon {
  kind: "tv";
  seasonCount: number | null;
  episodeCount: number | null;
}

export type MediaSummary =
  | AnimeMediaSummary
  | MangaMediaSummary
  | MovieMediaSummary
  | TvMediaSummary;

export interface MediaCastMember {
  name: string;
  character: string | null;
  order: number | null;
  profileUrl: string | null;
}

export interface MediaCrewMember {
  name: string;
  job: string | null;
  department: string | null;
}

export interface MediaVoiceActor {
  id: number;
  name: string;
  nativeName: string | null;
  imageUrl: string | null;
  language: string | null;
}

export interface MediaCharacter {
  id: number;
  name: string;
  nativeName: string | null;
  imageUrl: string | null;
  role: string;
  voiceActor: MediaVoiceActor | null;
}

export interface MediaTrailer {
  id: string | null;
  site: string | null;
  thumbnailUrl: string | null;
}

export interface MediaExternalLink {
  id: number;
  url: string;
  site: string;
  type: string | null;
  iconUrl: string | null;
  color: string | null;
}

export interface MediaTheme {
  id: string;
  slug: string;
  type: "OP" | "ED";
  title: string;
  artist: string;
  episodes: string | null;
  videoUrl: string | null;
  audioUrl: string | null;
}

/**
 * AniList summaries for relations and recommendations are retained as a
 * typed compatibility payload until canonical preview IDs are assigned.
 */
export interface AnimeLegacyDetails {
  recommendations: AnimeSummary[];
  relations: RelatedAnime[];
}

/** Existing AniList detail surfaces that are not yet fully provider-neutral. */
export interface AniListDetailExtras {
  characters: MediaCharacter[];
  trailer: MediaTrailer | null;
  externalLinks: MediaExternalLink[];
  tags: string[];
  themes: MediaTheme[];
  popularity: number | null;
  legacyAnimeDetails: AnimeLegacyDetails;
}

export interface TvSeason {
  seasonNumber: number;
  name: string | null;
  episodeCount: number | null;
  airDate: MediaDate | null;
  poster: MediaArtwork | null;
}

export interface TvNextEpisode {
  seasonNumber: number;
  episodeNumber: number;
  name: string | null;
  airDate: MediaDate | null;
}

export interface AnimeMediaDetails
  extends AnimeMediaSummary,
    AniListDetailExtras {
  durationMinutes: number | null;
  studios: string[];
  season: string | null;
  startDate: MediaDate | null;
  endDate: MediaDate | null;
}

export interface MangaMediaDetails
  extends MangaMediaSummary,
    AniListDetailExtras {
  authors: string[];
  artists: string[];
  publicationStatus: string | null;
  readingFormat: string | null;
  startDate: MediaDate | null;
  endDate: MediaDate | null;
}

export interface MovieMediaDetails
  extends MovieMediaSummary,
    AniListDetailExtras {
  releaseDate: MediaDate | null;
  productionCompanies: string[];
  cast: MediaCastMember[];
  crew: MediaCrewMember[];
}

export interface TvMediaDetails extends TvMediaSummary {
  episodeRuntimeMinutes: number | null;
  networks: string[];
  seasons: TvSeason[];
  nextEpisode: TvNextEpisode | null;
}

export type MediaDetails =
  | AnimeMediaDetails
  | MangaMediaDetails
  | MovieMediaDetails
  | TvMediaDetails;

export function isAnimeMedia(
  media: MediaSummary | MediaDetails,
): media is AnimeMediaSummary {
  return media.kind === "anime";
}

export function isMangaMedia(
  media: MediaSummary | MediaDetails,
): media is MangaMediaSummary {
  return media.kind === "manga";
}

export function isMovieMedia(
  media: MediaSummary | MediaDetails,
): media is MovieMediaSummary {
  return media.kind === "movie";
}

export function isTvMedia(
  media: MediaSummary | MediaDetails,
): media is TvMediaSummary {
  return media.kind === "tv";
}

export function isAnimeDetails(
  media: MediaDetails,
): media is AnimeMediaDetails {
  return media.kind === "anime";
}

export function isMangaDetails(
  media: MediaDetails,
): media is MangaMediaDetails {
  return media.kind === "manga";
}

export function isMovieDetails(
  media: MediaDetails,
): media is MovieMediaDetails {
  return media.kind === "movie";
}

export function isTvDetails(media: MediaDetails): media is TvMediaDetails {
  return media.kind === "tv";
}

/**
 * Existing database statuses are intentionally preserved. The UI can label
 * `watching` as "In Progress" or "Reading" without a data migration.
 */
export type MediaTrackingStatus = WatchStatus;

export type MediaProgress =
  | { kind: "anime"; episodesWatched: number }
  | { kind: "manga"; chaptersRead: number; volumesRead: number }
  | { kind: "movie"; watched: boolean }
  | {
      kind: "tv";
      seasonNumber: number;
      episodeNumber: number;
      episodesWatched: number;
    };

export interface MediaEpisodeProgress {
  /** Season number; existing anime rows use 0 when there is no season. */
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: string | null;
}

interface MediaLibraryEntryBase {
  /** Preserves the existing library-row UUID during migration. */
  id: string;
  userId: string;
  mediaId: CanonicalMediaId;
  status: MediaTrackingStatus;
  score: number | null;
  favorite: boolean;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  rewatchCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * The media kind and progress shape are correlated, so a movie entry cannot
 * carry episode progress and a manga entry cannot carry a watched state.
 */
export type MediaLibraryEntry = {
  [K in MediaKind]: MediaLibraryEntryBase & {
    mediaKind: K;
    progress: Extract<MediaProgress, { kind: K }>;
    episodeProgress?: K extends "anime" | "tv"
      ? MediaEpisodeProgress[]
      : never;
  };
}[MediaKind];

/**
 * A user's library row plus provider-neutral catalog metadata.
 *
 * `media` is nullable so a provider outage never hides a user's own progress,
 * rating or notes.
 */
export interface MediaLibraryItem {
  entry: MediaLibraryEntry;
  media: MediaSummary | null;
}
