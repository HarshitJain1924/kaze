import type {
  Anime,
  AnimeCharacter,
  AnimeDate,
  AnimeExternalLink,
  AnimeSummary,
  AnimeTrailer,
} from "@/types/anime";
import type { AnimeTheme } from "@/types/theme";
import {
  isCanonicalMediaId,
  isMediaArtworkRole,
  isMediaProvider,
} from "@/types/media";
import type {
  AniListDetailExtras,
  AnimeMediaDetails,
  AnimeMediaSummary,
  CanonicalMediaId,
  MangaMediaDetails,
  MangaMediaSummary,
  MediaArtwork,
  MediaArtworkRole,
  MediaCharacter,
  MediaCommunityRating,
  MediaDate,
  MediaDetails,
  MediaExternalLink,
  MediaFocalPoint,
  MediaProvider,
  MediaProviderRef,
  MediaTheme,
  MediaTitles,
  MediaTrailer,
  MediaVoiceActor,
  MovieMediaDetails,
  MovieMediaSummary,
} from "@/types/media";

/** AniList only maps to these three canonical media kinds. */
export type AniListMediaSummary =
  | AnimeMediaSummary
  | MangaMediaSummary
  | MovieMediaSummary;

export type AniListMediaKind = "anime" | "manga" | "movie";

/** AniList adapters only need the canonical ID assigned by the future DB row. */
export interface AniListAdapterContext {
  mediaId: CanonicalMediaId;
}

/** Provider-hosted artwork before optional metadata is normalized. */
export interface MediaArtworkInput {
  role: MediaArtworkRole;
  url: string | null | undefined;
  provider: MediaProvider;
  width?: number | null;
  height?: number | null;
  aspectRatio?: number | null;
  focalPoint?: MediaFocalPoint | null;
  language?: string | null;
  isPrimary?: boolean;
  attribution?: string | null;
}

function isSafeHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function safeUrl(value: string | null | undefined): string | null {
  return isSafeHttpUrl(value) ? value : null;
}

function isOptionalPositiveNumber(value: number | null | undefined): boolean {
  return (
    value === null ||
    value === undefined ||
    (Number.isFinite(value) && value > 0)
  );
}

function isValidFocalPoint(value: MediaFocalPoint | null | undefined): boolean {
  return (
    value === null ||
    value === undefined ||
    (Number.isFinite(value.x) &&
      Number.isFinite(value.y) &&
      value.x >= 0 &&
      value.x <= 1 &&
      value.y >= 0 &&
      value.y <= 1)
  );
}

function isRoleCompatibleWithAspectRatio(
  role: MediaArtworkRole,
  aspectRatio: number | null,
): boolean {
  if (aspectRatio === null) return true;
  if (role === "poster") return aspectRatio <= 1;
  if (role === "backdrop" || role === "banner") return aspectRatio >= 1;
  return true;
}

/**
 * Validates and normalizes provider artwork. Missing optional metadata is
 * accepted; malformed provided metadata is rejected rather than guessed.
 */
export function normalizeMediaArtwork(
  input: MediaArtworkInput,
): MediaArtwork | null {
  if (
    !isMediaArtworkRole(input.role) ||
    !isMediaProvider(input.provider) ||
    !isSafeHttpUrl(input.url)
  ) {
    return null;
  }

  if (
    !isOptionalPositiveNumber(input.width) ||
    !isOptionalPositiveNumber(input.height) ||
    !isOptionalPositiveNumber(input.aspectRatio) ||
    !isValidFocalPoint(input.focalPoint)
  ) {
    return null;
  }

  const effectiveAspectRatio =
    input.aspectRatio ??
    (input.width != null && input.height != null
      ? input.width / input.height
      : null);
  if (!isRoleCompatibleWithAspectRatio(input.role, effectiveAspectRatio)) {
    return null;
  }

  return {
    role: input.role,
    url: input.url,
    provider: input.provider,
    width: input.width ?? null,
    height: input.height ?? null,
    aspectRatio: input.aspectRatio ?? null,
    focalPoint: input.focalPoint
      ? { x: input.focalPoint.x, y: input.focalPoint.y }
      : null,
    language: input.language ?? null,
    isPrimary: input.isPrimary ?? false,
    attribution: input.attribution ?? null,
  };
}

function firstSafeArtwork(
  role: MediaArtworkRole,
  urls: readonly (string | null | undefined)[],
): MediaArtwork | null {
  for (const url of urls) {
    const artwork = normalizeMediaArtwork({
      role,
      url,
      provider: "anilist",
      isPrimary: true,
    });
    if (artwork) return artwork;
  }
  return null;
}

function displayTitle(titles: AnimeSummary["title"]): MediaTitles {
  return {
    primary:
      titles.english?.trim() ||
      titles.romaji?.trim() ||
      titles.native?.trim() ||
      "Untitled media",
    romaji: titles.romaji,
    english: titles.english,
    native: titles.native,
  };
}

function artworkForSummary(summary: AnimeSummary): MediaArtwork[] {
  const artwork: MediaArtwork[] = [];
  const poster = firstSafeArtwork("poster", [
    summary.coverImage.extraLarge,
    summary.coverImage.large,
  ]);

  if (poster) artwork.push(poster);

  const banner = firstSafeArtwork("banner", [summary.bannerImage]);
  if (banner) artwork.push(banner);

  return artwork;
}

function communityRatingFor(
  summary: AnimeSummary,
): MediaCommunityRating | null {
  if (
    summary.averageScore === null ||
    !Number.isFinite(summary.averageScore) ||
    summary.averageScore < 0 ||
    summary.averageScore > 100
  ) {
    return null;
  }

  return {
    score: summary.averageScore,
    scale: 100,
    provider: "anilist",
    count: null,
  };
}

function anilistKind(summary: AnimeSummary): AniListMediaKind {
  if (summary.mediaType === "manga") return "manga";
  if (summary.mediaType === "anime") {
    return summary.format === "MOVIE" ? "movie" : "anime";
  }

  if (summary.format === "MANGA" || summary.format === "ONE_SHOT") {
    return "manga";
  }
  if (summary.format === "MOVIE") return "movie";
  return "anime";
}

function providerRefsFor(
  summary: AnimeSummary,
  kind: AniListMediaKind,
): MediaProviderRef[] {
  return [
    {
      provider: "anilist",
      externalId: String(summary.id),
      sourceUrl: `https://anilist.co/${
        kind === "manga" ? "manga" : "anime"
      }/${summary.id}`,
    },
  ];
}

function toMediaDate(date: AnimeDate | null | undefined): MediaDate | null {
  if (
    !date ||
    date.year === null ||
    !Number.isInteger(date.year) ||
    date.year < 1
  ) {
    return null;
  }

  const month =
    date.month !== null &&
    Number.isInteger(date.month) &&
    date.month >= 1 &&
    date.month <= 12
      ? date.month
      : null;
  const day =
    month !== null &&
    date.day !== null &&
    Number.isInteger(date.day) &&
    date.day >= 1 &&
    date.day <= 31
      ? date.day
      : null;

  return { year: date.year, month, day };
}

function adaptVoiceActor(
  voiceActor: NonNullable<AnimeCharacter["voiceActor"]>,
): MediaVoiceActor {
  return {
    id: voiceActor.id,
    name: voiceActor.name.full,
    nativeName: voiceActor.name.native ?? null,
    imageUrl: safeUrl(voiceActor.image),
    language: voiceActor.language ?? null,
  };
}

function adaptCharacter(character: AnimeCharacter): MediaCharacter {
  return {
    id: character.id,
    name: character.name.full,
    nativeName: character.name.native ?? null,
    imageUrl: safeUrl(character.image),
    role: character.role,
    voiceActor: character.voiceActor
      ? adaptVoiceActor(character.voiceActor)
      : null,
  };
}

function adaptTrailer(
  trailer: AnimeTrailer | null | undefined,
): MediaTrailer | null {
  if (!trailer) return null;
  return {
    id: trailer.id,
    site: trailer.site,
    thumbnailUrl: safeUrl(trailer.thumbnail),
  };
}

function adaptExternalLink(
  link: AnimeExternalLink,
): MediaExternalLink | null {
  if (!isSafeHttpUrl(link.url)) return null;

  return {
    id: link.id,
    url: link.url,
    site: link.site,
    type: link.type,
    iconUrl: safeUrl(link.icon),
    color: link.color,
  };
}

function adaptTheme(theme: AnimeTheme): MediaTheme {
  return {
    id: theme.id,
    slug: theme.slug,
    type: theme.type,
    title: theme.title,
    artist: theme.artist,
    episodes: theme.episodes,
    videoUrl: theme.videoUrl,
    audioUrl: theme.audioUrl,
  };
}

function anilistDetailExtras(anime: Anime): AniListDetailExtras {
  return {
    characters: (anime.characters ?? []).map(adaptCharacter),
    trailer: adaptTrailer(anime.trailer),
    externalLinks: (anime.externalLinks ?? []).flatMap((link) => {
      const adapted = adaptExternalLink(link);
      return adapted ? [adapted] : [];
    }),
    tags: [...anime.tags],
    themes: (anime.themes ?? []).map(adaptTheme),
    popularity: anime.popularity,
    legacyAnimeDetails: {
      recommendations: [...(anime.recommendations ?? [])],
      relations: [...anime.relations],
    },
  };
}

function commonSummaryFields(summary: AnimeSummary, kind: AniListMediaKind) {
  return {
    title: displayTitle(summary.title),
    synopsis: null,
    artwork: artworkForSummary(summary),
    genres: [...summary.genres],
    releaseYear: summary.seasonYear,
    releaseStatus: summary.status,
    format: summary.format,
    communityRating: communityRatingFor(summary),
    providerRefs: providerRefsFor(summary, kind),
    isAdult: summary.isAdult ?? false,
  };
}

function assertCanonicalMediaId(value: CanonicalMediaId): void {
  if (!isCanonicalMediaId(value)) {
    throw new TypeError(
      "AniList adapters require a canonical UUID media ID at runtime.",
    );
  }
}

/**
 * Adapts the existing AniList summary into a discriminated media summary.
 *
 * This function is pure: it does not mutate the source and does not call
 * AniList, Kitsu or TMDB.
 */
export function adaptAniListSummary(
  summary: AnimeSummary,
  context: AniListAdapterContext,
): AniListMediaSummary {
  assertCanonicalMediaId(context.mediaId);

  const kind = anilistKind(summary);
  const common = commonSummaryFields(summary, kind);
  const base = {
    id: context.mediaId,
    title: common.title,
    synopsis: common.synopsis,
    artwork: common.artwork,
    genres: common.genres,
    releaseYear: common.releaseYear,
    releaseStatus: common.releaseStatus,
    format: common.format,
    communityRating: common.communityRating,
    providerRefs: common.providerRefs,
    isAdult: common.isAdult,
  };

  if (kind === "manga") {
    const manga: MangaMediaSummary = {
      ...base,
      kind: "manga",
      chapters: summary.chapters ?? null,
      volumes: summary.volumes ?? null,
      countryOfOrigin: summary.countryOfOrigin ?? null,
    };
    return manga;
  }

  if (kind === "movie") {
    const movie: MovieMediaSummary = {
      ...base,
      kind: "movie",
      runtimeMinutes: null,
    };
    return movie;
  }

  const anime: AnimeMediaSummary = {
    ...base,
    kind: "anime",
    episodes: summary.episodes,
    countryOfOrigin: summary.countryOfOrigin ?? null,
  };
  return anime;
}

/**
 * Adapts AniList's detail payload into the new media detail union.
 *
 * Authors/artists are empty today because the existing AniList query does not
 * request them; the contract leaves room for MangaDex/Kitsu enrichment later.
 */
export function adaptAniListDetails(
  anime: Anime,
  context: AniListAdapterContext,
): MediaDetails {
  const summary = adaptAniListSummary(anime, context);
  const extras = anilistDetailExtras(anime);

  if (summary.kind === "manga") {
    const manga: MangaMediaDetails = {
      ...summary,
      ...extras,
      kind: "manga",
      synopsis: anime.synopsis,
      authors: [],
      artists: [],
      publicationStatus: anime.status,
      readingFormat: anime.format,
      startDate: toMediaDate(anime.startDate),
      endDate: toMediaDate(anime.endDate),
    };
    return manga;
  }

  if (summary.kind === "movie") {
    const movie: MovieMediaDetails = {
      ...summary,
      ...extras,
      kind: "movie",
      synopsis: anime.synopsis,
      runtimeMinutes: anime.duration,
      releaseDate: toMediaDate(anime.startDate),
      productionCompanies: [],
      cast: [],
      crew: [],
    };
    return movie;
  }

  const details: AnimeMediaDetails = {
    ...summary,
    ...extras,
    kind: "anime",
    synopsis: anime.synopsis,
    durationMinutes: anime.duration,
    studios: (anime.studios ?? []).map((studio) => studio.name),
    season: anime.season,
    startDate: toMediaDate(anime.startDate),
    endDate: toMediaDate(anime.endDate),
  };
  return details;
}
