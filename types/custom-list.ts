import type { MediaType } from "@/types/anime";
import type { TmdbKind } from "@/types/tmdb";

/**
 * A curated-list entry. Anime and manga items carry an `anilistId`; films and
 * TV shows carry a `tmdbId` plus the TMDB kind, so both catalogues can share
 * one list without colliding ids.
 */
export interface CustomListItem {
  id: string;
  /** AniList media id. Absent for film and TV entries. */
  anilistId?: number;
  /** TMDB id. Present only for film and TV entries. */
  tmdbId?: number;
  tmdbKind?: TmdbKind;
  title: string;
  mediaType?: MediaType;
  coverImage: string | null;
  bannerImage?: string | null;
  format?: string | null;
  averageScore?: number | null;
  rank?: number;
  notes?: string;
  addedAt: string;
}

export interface CustomList {
  id: string;
  title: string;
  description: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  items: CustomListItem[];
}

export interface ListProgress {
  watchedCount: number;
  totalCount: number;
  percentage: number;
  isFullyWatched: boolean;
}

export type ListItemIdentity = Pick<
  CustomListItem,
  "anilistId" | "tmdbId" | "tmdbKind"
>;

/**
 * Stable identity for duplicates and every list mutation. Stored items written
 * before films and TV existed always have an `anilistId`, so their key is
 * unchanged by this migration.
 */
export function customListItemKey(item: ListItemIdentity): string {
  if (item.tmdbId !== undefined) {
    return `tmdb:${item.tmdbKind ?? "movie"}:${item.tmdbId}`;
  }
  return `anilist:${item.anilistId ?? "unknown"}`;
}

export function customListItemHref(item: ListItemIdentity): string {
  if (item.tmdbId !== undefined) {
    return `/screen/${item.tmdbKind ?? "movie"}/${item.tmdbId}`;
  }
  return `/media/${item.anilistId ?? ""}`;
}

/** Small badge label for entries that are not AniList media. */
export function customListItemLabel(item: ListItemIdentity): string | null {
  if (item.tmdbId === undefined) return null;
  return item.tmdbKind === "tv" ? "TV" : "Film";
}

/** What the add-to-list modal collects before it becomes a stored item. */
export interface CustomListCandidate {
  anilistId?: number;
  tmdbId?: number;
  tmdbKind?: TmdbKind;
  title: string;
  mediaType?: MediaType;
  coverImage: string | null;
  bannerImage?: string | null;
  format?: string | null;
  averageScore?: number | null;
}
