import { stripHtml, isHttpUrl } from "@/lib/utils";
import type {
  Anime,
  AnimeDate,
  AnimePage,
  AnimeSummary,
  RelatedAnime,
} from "@/types/anime";

import { AniListError } from "./errors";
import {
  animeSchema,
  animeSummarySchema,
  mediaListPageSchema,
  type ValidatedAnime,
  type ValidatedAnimeSummary,
} from "./schemas";

function sanitizeImage(url: string | null): string | null {
  return isHttpUrl(url) ? url : null;
}

function mapDate(date: ValidatedAnime["startDate"]): AnimeDate | null {
  if (!date) {
    return null;
  }
  const year = date.year ?? null;
  const month =
    date.month !== null && date.month >= 1 && date.month <= 12
      ? date.month
      : null;
  const day =
    date.day !== null && date.day >= 1 && date.day <= 31 ? date.day : null;
  if (year === null && month === null && day === null) {
    return null;
  }
  return { year, month, day };
}

function normalizeGenres(genres: string[]): string[] {
  const seen = new Set<string>();
  for (const genre of genres) {
    const trimmed = genre.trim();
    if (trimmed) {
      seen.add(trimmed);
    }
  }
  return [...seen];
}

function mapSummaryFields(raw: ValidatedAnimeSummary) {
  const cover = raw.coverImage;
  return {
    id: raw.id,
    title: {
      romaji: raw.title.romaji,
      english: raw.title.english,
      native: raw.title.native,
    },
    coverImage: {
      extraLarge: sanitizeImage(cover.extraLarge),
      large: sanitizeImage(cover.large),
      color: cover.color,
    },
    format: raw.format,
    episodes:
      raw.episodes !== null && raw.episodes >= 0 ? raw.episodes : null,
    averageScore:
      raw.averageScore !== null &&
      raw.averageScore >= 0 &&
      raw.averageScore <= 100
        ? raw.averageScore
        : null,
    seasonYear: raw.seasonYear,
    status: raw.status,
    genres: normalizeGenres(raw.genres),
  };
}

/** Maps a single media node, returning `null` for unusable payloads. */
export function mapAnimeSummary(raw: unknown): AnimeSummary | null {
  const parsed = animeSummarySchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }
  return mapSummaryFields(parsed.data);
}

/** Maps a full media node used by the details screen. */
export function mapAnime(raw: unknown): Anime | null {
  const parsed = animeSchema.safeParse(raw);
  if (!parsed.success) {
    return null;
  }

  const summary = mapSummaryFields(parsed.data);
  const relations: RelatedAnime[] = [];

  for (const edge of parsed.data.relations?.edges ?? []) {
    // Relations can point at manga or other media types.
    if (edge.node.type !== "ANIME") {
      continue;
    }
    const node = mapAnimeSummary(edge.node);
    if (!node) {
      continue;
    }
    relations.push({ ...node, relationType: edge.relationType });
  }

  return {
    ...summary,
    bannerImage: sanitizeImage(parsed.data.bannerImage),
    synopsis: stripHtml(parsed.data.description),
    tags: normalizeTags(parsed.data.tags),
    season: parsed.data.season,
    duration:
      parsed.data.duration !== null && parsed.data.duration > 0
        ? parsed.data.duration
        : null,
    popularity:
      parsed.data.popularity !== null && parsed.data.popularity >= 0
        ? parsed.data.popularity
        : null,
    startDate: mapDate(parsed.data.startDate),
    endDate: mapDate(parsed.data.endDate),
    relations: dedupeRelations(relations),
  };
}

function normalizeTags(
  tags: Array<{ name: string; isMediaSpoiler?: boolean | null }>,
): string[] {
  const seen = new Set<string>();
  for (const tag of tags) {
    const name = tag.name.trim();
    if (name && !tag.isMediaSpoiler) {
      seen.add(name);
    }
  }
  return [...seen];
}

function dedupeRelations(relations: RelatedAnime[]): RelatedAnime[] {
  const seen = new Map<number, RelatedAnime>();
  for (const relation of relations) {
    if (!seen.has(relation.id)) {
      seen.set(relation.id, relation);
    }
  }
  return [...seen.values()];
}

/**
 * Maps a GraphQL `Page` payload. Individual malformed entries are skipped
 * (and reported) rather than failing the whole page; a page where every
 * entry is malformed is treated as a provider error.
 */
export function mapAnimePage(raw: unknown, fallbackPage = 1): AnimePage {
  const parsed = mediaListPageSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AniListError("AniList returned an unexpected response shape", {
      cause: parsed.error,
    });
  }

  const rawItems = parsed.data.media ?? [];
  const items: AnimeSummary[] = [];
  let skipped = 0;

  for (const item of rawItems) {
    const summary = mapAnimeSummary(item);
    if (summary) {
      items.push(summary);
    } else {
      skipped += 1;
    }
  }

  if (rawItems.length > 0 && items.length === 0) {
    throw new AniListError("AniList returned no readable anime entries");
  }

  if (skipped > 0) {
    console.warn(
      `[anilist] skipped ${skipped} malformed media ${skipped === 1 ? "entry" : "entries"}`,
    );
  }

  const pageInfo = parsed.data.pageInfo;
  return {
    items,
    pageInfo: {
      currentPage: pageInfo.currentPage ?? fallbackPage,
      lastPage: pageInfo.lastPage,
      hasNextPage: pageInfo.hasNextPage ?? false,
      total: pageInfo.total,
    },
  };
}

/** Maps a list of media nodes, skipping malformed entries. */
export function mapAnimeList(raw: unknown): AnimeSummary[] {
  if (!Array.isArray(raw)) {
    throw new AniListError("AniList returned an unexpected list shape");
  }
  const items: AnimeSummary[] = [];
  for (const item of raw) {
    const summary = mapAnimeSummary(item);
    if (summary) {
      items.push(summary);
    }
  }
  return items;
}
