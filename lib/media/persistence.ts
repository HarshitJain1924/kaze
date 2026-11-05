import { createHash } from "node:crypto";

import { isWatchStatus } from "@/types/library";
import {
  isCanonicalMediaId,
  isMediaKind,
  toCanonicalMediaId,
  type CanonicalMediaId,
  type MediaKind,
  type MediaLibraryEntry,
} from "@/types/media";

export interface LegacyUserAnimeRow {
  id: string;
  userId: string;
  anilistId: number;
  mediaType: string;
  status: string;
  progress: number;
  volumesProgress: number;
  score: number | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LegacyUserAnimeEpisodeRow {
  id: string;
  userId: string;
  anilistId: number;
  episodeNumber: number;
  watchedAt: string;
  createdAt: string;
}

export type BackfillIssueReason =
  | "invalid-legacy-id"
  | "invalid-media-type"
  | "invalid-status"
  | "invalid-progress"
  | "invalid-score"
  | "invalid-notes"
  | "conflicting-media-kind"
  | "conflicting-provider-mapping"
  | "conflicting-canonical-media-kind"
  | "conflicting-media-kind-existing"
  | "conflicting-media-kind-cache"
  | "missing-catalog-cache"
  | "malformed-catalog-cache"
  | "conflicting-catalog-cache"
  | "conflicting-library-user-ownership"
  | "conflicting-library-media-id"
  | "conflicting-library-media-kind"
  | "conflicting-library-progress"
  | "conflicting-library-status"
  | "conflicting-library-score"
  | "conflicting-library-notes"
  | "orphan-episode"
  | "manga-episode-history"
  | "movie-episode-history"
  | "episode-parent-not-migrated"
  | "conflicting-episode-user-ownership"
  | "conflicting-episode-parent"
  | "conflicting-episode-number"
  | "duplicate-episode";

export interface BackfillIssue {
  legacyTable: "user_anime" | "user_anime_episodes";
  legacyId: string;
  reason: BackfillIssueReason;
  details: Record<string, string | number | null>;
}

export interface PlannedMediaRow {
  id: CanonicalMediaId;
  kind: MediaKind;
}

export interface PlannedExternalIdRow {
  mediaId: CanonicalMediaId;
  provider: "anilist";
  externalId: string;
}

export interface PlannedUserMediaRow {
  id: string;
  userId: string;
  mediaId: CanonicalMediaId;
  mediaKind: MediaKind;
  status: string;
  progress:
    | { kind: "anime"; episodesWatched: number }
    | { kind: "manga"; chaptersRead: number; volumesRead: number }
    | { kind: "movie"; watched: boolean }
    | { kind: "tv"; seasonNumber: number; episodeNumber: number; episodesWatched: number };
  score: number | null;
  favorite: boolean;
  notes: string | null;
  rewatchCount: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlannedEpisodeRow {
  id: string;
  userId: string;
  userMediaId: string;
  mediaKind: "anime" | "tv";
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: string;
  createdAt: string;
}

export interface BackfillPlan {
  media: PlannedMediaRow[];
  externalIds: PlannedExternalIdRow[];
  userMedia: PlannedUserMediaRow[];
  episodes: PlannedEpisodeRow[];
  issues: BackfillIssue[];
}

export interface CatalogCacheEntry {
  format?: string | null;
  mediaType?: string | null;
}

export interface ExistingUserMediaRow {
  id: string;
  userId: string;
  mediaId: CanonicalMediaId;
  mediaKind: MediaKind;
  status: string;
  progress:
    | { kind: "anime"; episodesWatched: number }
    | { kind: "manga"; chaptersRead: number; volumesRead: number }
    | { kind: "movie"; watched: boolean }
    | { kind: "tv"; seasonNumber: number; episodeNumber: number; episodesWatched: number };
  score: number | null;
  notes?: string | null;
}

export interface ExistingEpisodeRow {
  id: string;
  userId: string;
  userMediaId: string;
  mediaKind?: "anime" | "tv";
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: string;
}

export interface BackfillOptions {
  /** Existing verified mappings, keyed by `provider:externalId`. */
  existingMappings?: ReadonlyMap<
    string,
    { mediaId: CanonicalMediaId; kind: MediaKind }
  >;
  /** Existing canonical media rows, keyed by canonical media UUID. */
  existingMedia?: ReadonlyMap<
    CanonicalMediaId,
    { id: CanonicalMediaId; kind: MediaKind }
  >;
  /** Existing user library rows, keyed by userMediaId or `userId:mediaId`. */
  existingUserMedia?: ReadonlyMap<string, ExistingUserMediaRow>;
  /** Existing episode rows, keyed by episodeId or `userMediaId:season:episode`. */
  existingEpisodes?: ReadonlyMap<string, ExistingEpisodeRow>;
  /** Cached catalog metadata, keyed by anilistId or `details:${anilistId}` / `summary:${anilistId}`. */
  catalogCache?: ReadonlyMap<
    number | string,
    CatalogCacheEntry | CatalogCacheEntry[] | { payload?: unknown }
  >;
}

export class MediaLibraryInvariantError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaLibraryInvariantError";
  }
}

export function legacyAniListMappingKey(anilistId: number): string {
  return `anilist:${anilistId}`;
}

/**
 * Stable UUID for legacy AniList records. This is deliberately derived from
 * the provider ID only so a retried backfill resolves the same canonical row.
 * It is a migration lookup key, not a replacement for provider mappings.
 */
export function deterministicAniListMediaId(
  anilistId: number,
): CanonicalMediaId {
  const digest = createHash("md5")
    .update(`kaze:anilist:${anilistId}`)
    .digest("hex");
  const rawUuid = [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `5${digest.slice(13, 16)}`,
    `8${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join("-");
  const mediaId = toCanonicalMediaId(rawUuid);
  if (!mediaId) {
    throw new Error("Could not derive a canonical media UUID");
  }
  return mediaId;
}

export function canonicalKindForLegacyMediaType(
  mediaType: string,
): "anime" | "manga" | null {
  if (mediaType === "anime" || mediaType === "manga") return mediaType;
  return null;
}

function issueKey(issue: BackfillIssue): string {
  return `${issue.legacyTable}:${issue.legacyId}:${issue.reason}`;
}

function validProgressForKind(
  mediaType: "anime" | "manga",
  progress: number,
  volumesProgress: number,
): boolean {
  if (!Number.isInteger(progress) || progress < 0) return false;
  if (!Number.isInteger(volumesProgress) || volumesProgress < 0) return false;
  return mediaType === "manga" || volumesProgress === 0;
}

const ANIME_SERIES_FORMATS = new Set([
  "TV",
  "TV_SHORT",
  "OVA",
  "ONA",
  "SPECIAL",
  "MUSIC",
]);

interface ExtractedCacheFormat {
  status: "ok" | "missing" | "malformed" | "conflicting";
  format?: string;
}

function extractCandidateFormat(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  if (typeof record.format === "string" && record.format.trim()) {
    return record.format.trim().toUpperCase();
  }
  if (
    record.payload &&
    typeof record.payload === "object" &&
    "format" in record.payload
  ) {
    const payload = record.payload as Record<string, unknown>;
    if (typeof payload.format === "string" && payload.format.trim()) {
      return payload.format.trim().toUpperCase();
    }
  }
  return null;
}

function resolveCacheFormat(
  anilistId: number,
  cache?: BackfillOptions["catalogCache"],
): ExtractedCacheFormat {
  if (!cache) {
    return { status: "missing" };
  }

  // Probe possible lookup keys
  const candidates: unknown[] = [];
  if (cache.has(anilistId)) candidates.push(cache.get(anilistId));
  if (cache.has(`details:${anilistId}`)) candidates.push(cache.get(`details:${anilistId}`));
  if (cache.has(`summary:${anilistId}`)) candidates.push(cache.get(`summary:${anilistId}`));

  if (candidates.length === 0) {
    return { status: "missing" };
  }

  const formats = new Set<string>();
  let hasNullFormat = false;

  for (const item of candidates) {
    if (Array.isArray(item)) {
      for (const sub of item) {
        const fmt = extractCandidateFormat(sub);
        if (fmt) {
          formats.add(fmt);
        } else {
          hasNullFormat = true;
        }
      }
    } else if (item && typeof item === "object") {
      const fmt = extractCandidateFormat(item);
      if (fmt) {
        formats.add(fmt);
      } else {
        hasNullFormat = true;
      }
    }
  }

  if (formats.size > 1) {
    return { status: "conflicting" };
  }

  if (formats.size === 0) {
    return hasNullFormat ? { status: "malformed" } : { status: "missing" };
  }

  const format = [...formats][0]!;
  return { status: "ok", format };
}

/**
 * Plans the additive migration without touching a database. The SQL backfill
 * mirrors these rules; tests keep the two implementations aligned on identity,
 * progress shape, episode season convention and quarantine behavior.
 */
export function planLegacyBackfill(
  userAnime: readonly LegacyUserAnimeRow[],
  episodes: readonly LegacyUserAnimeEpisodeRow[],
  options: BackfillOptions = {},
): BackfillPlan {
  const issues: BackfillIssue[] = [];
  const issueKeys = new Set<string>();
  const mediaById = new Map<CanonicalMediaId, PlannedMediaRow>();
  const externalIdsByKey = new Map<string, PlannedExternalIdRow>();
  const userMediaById = new Map<string, PlannedUserMediaRow>();
  const plannedEpisodeKeys = new Set<string>();
  const plannedEpisodes: PlannedEpisodeRow[] = [];

  function addIssue(issue: BackfillIssue): void {
    const key = issueKey(issue);
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    issues.push(issue);
  }

  const kindsByAniListId = new Map<number, Set<MediaKind>>();
  for (const row of userAnime) {
    if (!Number.isInteger(row.anilistId) || row.anilistId <= 0) continue;
    const kind = canonicalKindForLegacyMediaType(row.mediaType);
    if (!kind) continue;
    const kinds = kindsByAniListId.get(row.anilistId) ?? new Set();
    kinds.add(kind);
    kindsByAniListId.set(row.anilistId, kinds);
  }

  const conflictingAniListIds = new Set(
    [...kindsByAniListId.entries()]
      .filter(([, kinds]) => kinds.size > 1)
      .map(([id]) => id),
  );

  for (const row of userAnime) {
    if (!Number.isInteger(row.anilistId) || row.anilistId <= 0) {
      addIssue({
        legacyTable: "user_anime",
        legacyId: row.id,
        reason: "invalid-legacy-id",
        details: { anilistId: row.anilistId },
      });
      continue;
    }

    const legacyKind = canonicalKindForLegacyMediaType(row.mediaType);
    if (!legacyKind) {
      addIssue({
        legacyTable: "user_anime",
        legacyId: row.id,
        reason: "invalid-media-type",
        details: { mediaType: row.mediaType },
      });
      continue;
    }

    if (conflictingAniListIds.has(row.anilistId)) {
      addIssue({
        legacyTable: "user_anime",
        legacyId: row.id,
        reason: "conflicting-media-kind",
        details: { anilistId: row.anilistId },
      });
      continue;
    }

    if (!isWatchStatus(row.status)) {
      addIssue({
        legacyTable: "user_anime",
        legacyId: row.id,
        reason: "invalid-status",
        details: { status: row.status },
      });
      continue;
    }

    if (!validProgressForKind(legacyKind, row.progress, row.volumesProgress)) {
      addIssue({
        legacyTable: "user_anime",
        legacyId: row.id,
        reason: "invalid-progress",
        details: {
          progress: row.progress,
          volumesProgress: row.volumesProgress,
        },
      });
      continue;
    }

    if (row.score !== null && (!Number.isInteger(row.score) || row.score < 1 || row.score > 10)) {
      addIssue({
        legacyTable: "user_anime",
        legacyId: row.id,
        reason: "invalid-score",
        details: { score: row.score },
      });
      continue;
    }

    if (row.notes !== null && row.notes.length > 5000) {
      addIssue({
        legacyTable: "user_anime",
        legacyId: row.id,
        reason: "invalid-notes",
        details: { notesLength: row.notes.length },
      });
      continue;
    }

    // Determine canonical kind using catalog_cache
    let targetKind: MediaKind = legacyKind;
    if (legacyKind === "manga") {
      const cacheCheck = resolveCacheFormat(row.anilistId, options.catalogCache);
      if (cacheCheck.status === "ok" && cacheCheck.format) {
        if (
          cacheCheck.format === "MOVIE" ||
          ANIME_SERIES_FORMATS.has(cacheCheck.format)
        ) {
          addIssue({
            legacyTable: "user_anime",
            legacyId: row.id,
            reason: "conflicting-media-kind-cache",
            details: {
              anilistId: row.anilistId,
              legacyType: "manga",
              cachedFormat: cacheCheck.format,
            },
          });
          continue;
        }
      }
      targetKind = "manga";
    } else {
      // Anime: determine whether anime series or movie
      const cacheRes = resolveCacheFormat(row.anilistId, options.catalogCache);
      if (cacheRes.status === "missing") {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "missing-catalog-cache",
          details: { anilistId: row.anilistId, mediaType: row.mediaType },
        });
        continue;
      }
      if (cacheRes.status === "conflicting") {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-catalog-cache",
          details: { anilistId: row.anilistId },
        });
        continue;
      }
      if (cacheRes.status === "malformed" || !cacheRes.format) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "malformed-catalog-cache",
          details: { anilistId: row.anilistId, format: cacheRes.format ?? null },
        });
        continue;
      }

      if (cacheRes.format === "MOVIE") {
        targetKind = "movie";
      } else if (ANIME_SERIES_FORMATS.has(cacheRes.format)) {
        targetKind = "anime";
      } else {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "malformed-catalog-cache",
          details: { anilistId: row.anilistId, format: cacheRes.format },
        });
        continue;
      }
    }

    const mediaId = deterministicAniListMediaId(row.anilistId);
    const mappingKey = legacyAniListMappingKey(row.anilistId);

    // 1. Conflict check against existing canonical media
    const existingMedia = options.existingMedia?.get(mediaId) ?? mediaById.get(mediaId);
    if (existingMedia && existingMedia.kind !== targetKind) {
      addIssue({
        legacyTable: "user_anime",
        legacyId: row.id,
        reason: "conflicting-canonical-media-kind",
        details: {
          anilistId: row.anilistId,
          existingKind: existingMedia.kind,
          attemptedKind: targetKind,
        },
      });
      continue;
    }

    // 2. Conflict check against existing provider mappings
    const existingMapping = options.existingMappings?.get(mappingKey);
    if (
      existingMapping &&
      (existingMapping.mediaId !== mediaId || existingMapping.kind !== targetKind)
    ) {
      addIssue({
        legacyTable: "user_anime",
        legacyId: row.id,
        reason: "conflicting-provider-mapping",
        details: {
          anilistId: row.anilistId,
          existingMediaId: existingMapping.mediaId,
        },
      });
      continue;
    }

    // 3. Conflict check against existing library entries
    const existingUserMedia =
      options.existingUserMedia?.get(row.id) ??
      options.existingUserMedia?.get(`${row.userId}:${mediaId}`);

    if (existingUserMedia) {
      if (existingUserMedia.userId !== row.userId) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-user-ownership",
          details: {
            libraryId: existingUserMedia.id,
            existingUserId: existingUserMedia.userId,
            attemptedUserId: row.userId,
          },
        });
        continue;
      }

      if (existingUserMedia.mediaId !== mediaId) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-media-id",
          details: {
            libraryId: existingUserMedia.id,
            existingMediaId: existingUserMedia.mediaId,
            attemptedMediaId: mediaId,
          },
        });
        continue;
      }

      if (existingUserMedia.mediaKind !== targetKind) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-media-kind",
          details: {
            libraryId: existingUserMedia.id,
            existingMediaKind: existingUserMedia.mediaKind,
            attemptedMediaKind: targetKind,
          },
        });
        continue;
      }

      if (existingUserMedia.status !== row.status) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-status",
          details: {
            libraryId: existingUserMedia.id,
            existingStatus: existingUserMedia.status,
            attemptedStatus: row.status,
          },
        });
        continue;
      }

      let progressConflicts = false;
      if (targetKind === "anime") {
        progressConflicts =
          existingUserMedia.progress.kind !== "anime" ||
          existingUserMedia.progress.episodesWatched !== row.progress;
      } else if (targetKind === "manga") {
        progressConflicts =
          existingUserMedia.progress.kind !== "manga" ||
          existingUserMedia.progress.chaptersRead !== row.progress ||
          existingUserMedia.progress.volumesRead !== row.volumesProgress;
      } else if (targetKind === "movie") {
        const targetWatched = row.status === "completed" || row.progress >= 1;
        progressConflicts =
          existingUserMedia.progress.kind !== "movie" ||
          existingUserMedia.progress.watched !== targetWatched;
      }

      if (progressConflicts) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-progress",
          details: {
            libraryId: existingUserMedia.id,
            progress: row.progress,
          },
        });
        continue;
      }

      if (existingUserMedia.score !== row.score) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-score",
          details: {
            libraryId: existingUserMedia.id,
            existingScore: existingUserMedia.score,
            attemptedScore: row.score,
          },
        });
        continue;
      }

      if (
        existingUserMedia.notes !== undefined &&
        existingUserMedia.notes !== row.notes
      ) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-notes",
          details: {
            libraryId: existingUserMedia.id,
          },
        });
        continue;
      }

      // If existing user media matches identically, this is an idempotent rerun.
      // We don't re-insert, but record in userMediaById for parent episode lookup.
      userMediaById.set(row.id, {
        id: existingUserMedia.id,
        userId: existingUserMedia.userId,
        mediaId: existingUserMedia.mediaId,
        mediaKind: existingUserMedia.mediaKind,
        status: existingUserMedia.status,
        progress: existingUserMedia.progress,
        score: existingUserMedia.score,
        favorite: false,
        notes: existingUserMedia.notes ?? null,
        rewatchCount: 0,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
      continue;
    }

    mediaById.set(mediaId, { id: mediaId, kind: targetKind });
    externalIdsByKey.set(mappingKey, {
      mediaId,
      provider: "anilist",
      externalId: String(row.anilistId),
    });

    const plannedProgress =
      targetKind === "anime"
        ? { kind: "anime" as const, episodesWatched: row.progress }
        : targetKind === "manga"
          ? {
              kind: "manga" as const,
              chaptersRead: row.progress,
              volumesRead: row.volumesProgress,
            }
          : {
              kind: "movie" as const,
              watched: row.status === "completed" || row.progress >= 1,
            };

    userMediaById.set(row.id, {
      id: row.id,
      userId: row.userId,
      mediaId,
      mediaKind: targetKind,
      status: row.status,
      progress: plannedProgress,
      score: row.score,
      favorite: false,
      notes: row.notes,
      rewatchCount: 0,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }

  const legacyByUserAndAniList = new Map<string, LegacyUserAnimeRow>();
  for (const row of userAnime) {
    legacyByUserAndAniList.set(`${row.userId}:${row.anilistId}`, row);
  }

  for (const episode of episodes) {
    const parent = legacyByUserAndAniList.get(
      `${episode.userId}:${episode.anilistId}`,
    );
    if (!parent) {
      addIssue({
        legacyTable: "user_anime_episodes",
        legacyId: episode.id,
        reason: "orphan-episode",
        details: {
          userId: episode.userId,
          anilistId: episode.anilistId,
        },
      });
      continue;
    }

    if (parent.mediaType === "manga") {
      addIssue({
        legacyTable: "user_anime_episodes",
        legacyId: episode.id,
        reason: "manga-episode-history",
        details: { anilistId: episode.anilistId },
      });
      continue;
    }

    const userMedia = userMediaById.get(parent.id);
    if (!userMedia) {
      addIssue({
        legacyTable: "user_anime_episodes",
        legacyId: episode.id,
        reason: "episode-parent-not-migrated",
        details: { anilistId: episode.anilistId },
      });
      continue;
    }

    // Episode history is strictly prohibited on movie entries
    if (userMedia.mediaKind === "movie") {
      addIssue({
        legacyTable: "user_anime_episodes",
        legacyId: episode.id,
        reason: "movie-episode-history",
        details: { anilistId: episode.anilistId },
      });
      continue;
    }

    if (userMedia.mediaKind !== "anime" && userMedia.mediaKind !== "tv") {
      addIssue({
        legacyTable: "user_anime_episodes",
        legacyId: episode.id,
        reason: "episode-parent-not-migrated",
        details: { anilistId: episode.anilistId },
      });
      continue;
    }

    if (!Number.isInteger(episode.episodeNumber) || episode.episodeNumber <= 0) {
      addIssue({
        legacyTable: "user_anime_episodes",
        legacyId: episode.id,
        reason: "invalid-progress",
        details: { episodeNumber: episode.episodeNumber },
      });
      continue;
    }

    // Conflict check against existing episode records
    const existingEpisode =
      options.existingEpisodes?.get(episode.id) ??
      options.existingEpisodes?.get(`${userMedia.id}:0:${episode.episodeNumber}`);

    if (existingEpisode) {
      if (existingEpisode.userId !== episode.userId) {
        addIssue({
          legacyTable: "user_anime_episodes",
          legacyId: episode.id,
          reason: "conflicting-episode-user-ownership",
          details: {
            episodeId: existingEpisode.id,
            existingUserId: existingEpisode.userId,
            attemptedUserId: episode.userId,
          },
        });
        continue;
      }

      if (existingEpisode.userMediaId !== userMedia.id) {
        addIssue({
          legacyTable: "user_anime_episodes",
          legacyId: episode.id,
          reason: "conflicting-episode-parent",
          details: {
            episodeId: existingEpisode.id,
            existingParentId: existingEpisode.userMediaId,
            attemptedParentId: userMedia.id,
          },
        });
        continue;
      }

      if (existingEpisode.episodeNumber !== episode.episodeNumber) {
        addIssue({
          legacyTable: "user_anime_episodes",
          legacyId: episode.id,
          reason: "conflicting-episode-number",
          details: {
            episodeId: existingEpisode.id,
            existingNumber: existingEpisode.episodeNumber,
            attemptedNumber: episode.episodeNumber,
          },
        });
        continue;
      }

      // Identical rerun -> skip insert without issue
      continue;
    }

    const episodeKey = `${userMedia.id}:0:${episode.episodeNumber}`;
    if (plannedEpisodeKeys.has(episodeKey)) {
      addIssue({
        legacyTable: "user_anime_episodes",
        legacyId: episode.id,
        reason: "duplicate-episode",
        details: { episodeNumber: episode.episodeNumber },
      });
      continue;
    }
    plannedEpisodeKeys.add(episodeKey);
    plannedEpisodes.push({
      id: episode.id,
      userId: episode.userId,
      userMediaId: userMedia.id,
      mediaKind: "anime",
      seasonNumber: 0,
      episodeNumber: episode.episodeNumber,
      watchedAt: episode.watchedAt,
      createdAt: episode.createdAt,
    });
  }

  // Filter out any media that only matched an existing row and wasn't newly planned
  const newlyPlannedUserMedia = [...userMediaById.values()].filter(
    (row) => !options.existingUserMedia?.has(row.id),
  );

  return {
    media: [...mediaById.values()],
    externalIds: [...externalIdsByKey.values()],
    userMedia: newlyPlannedUserMedia,
    episodes: plannedEpisodes,
    issues,
  };
}

/**
 * Validates unknown runtime input against the canonical MediaLibraryEntry contract.
 * Rejects malformed IDs, invalid media kinds, incompatible progress, negative counts,
 * and scores outside 1-10 without type assertions.
 */
export function validateMediaLibraryEntry(input: unknown): MediaLibraryEntry {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new MediaLibraryInvariantError("Library entry must be a non-null object");
  }
  const candidate = input as Record<string, unknown>;

  if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
    throw new MediaLibraryInvariantError("Library entry ID must be a non-empty string");
  }

  if (typeof candidate.userId !== "string" || candidate.userId.trim().length === 0) {
    throw new MediaLibraryInvariantError("Library entry userId must be a non-empty string");
  }

  if (!isCanonicalMediaId(candidate.mediaId)) {
    throw new MediaLibraryInvariantError("Library entry mediaId must be a valid canonical UUID");
  }

  if (!isMediaKind(candidate.mediaKind)) {
    throw new MediaLibraryInvariantError("Library entry mediaKind is invalid");
  }

  if (!isWatchStatus(candidate.status)) {
    throw new MediaLibraryInvariantError("Library entry status is invalid");
  }

  if (candidate.score !== null && candidate.score !== undefined) {
    if (
      typeof candidate.score !== "number" ||
      !Number.isInteger(candidate.score) ||
      candidate.score < 1 ||
      candidate.score > 10
    ) {
      throw new MediaLibraryInvariantError("Score must be null or an integer between 1 and 10");
    }
  }

  if (
    typeof candidate.rewatchCount !== "number" ||
    !Number.isInteger(candidate.rewatchCount) ||
    candidate.rewatchCount < 0
  ) {
    throw new MediaLibraryInvariantError("Rewatch count must be a non-negative integer");
  }

  if (typeof candidate.favorite !== "boolean") {
    throw new MediaLibraryInvariantError("Favorite must be a boolean");
  }

  if (candidate.notes !== null && candidate.notes !== undefined) {
    if (typeof candidate.notes !== "string" || candidate.notes.length > 5000) {
      throw new MediaLibraryInvariantError("Notes must be a string up to 5000 characters or null");
    }
  }

  if (!candidate.progress || typeof candidate.progress !== "object" || Array.isArray(candidate.progress)) {
    throw new MediaLibraryInvariantError("Progress must be an object");
  }
  const progress = candidate.progress as Record<string, unknown>;
  if (progress.kind !== candidate.mediaKind) {
    throw new MediaLibraryInvariantError("Progress kind does not match mediaKind");
  }

  if (candidate.mediaKind === "anime") {
    if (
      typeof progress.episodesWatched !== "number" ||
      !Number.isInteger(progress.episodesWatched) ||
      progress.episodesWatched < 0
    ) {
      throw new MediaLibraryInvariantError("Anime episodesWatched must be a non-negative integer");
    }
  } else if (candidate.mediaKind === "manga") {
    if (
      typeof progress.chaptersRead !== "number" ||
      !Number.isInteger(progress.chaptersRead) ||
      progress.chaptersRead < 0 ||
      typeof progress.volumesRead !== "number" ||
      !Number.isInteger(progress.volumesRead) ||
      progress.volumesRead < 0
    ) {
      throw new MediaLibraryInvariantError("Manga chaptersRead and volumesRead must be non-negative integers");
    }
  } else if (candidate.mediaKind === "movie") {
    if (typeof progress.watched !== "boolean") {
      throw new MediaLibraryInvariantError("Movie watched must be a boolean");
    }
  } else if (candidate.mediaKind === "tv") {
    if (
      typeof progress.seasonNumber !== "number" ||
      !Number.isInteger(progress.seasonNumber) ||
      progress.seasonNumber < 0 ||
      typeof progress.episodeNumber !== "number" ||
      !Number.isInteger(progress.episodeNumber) ||
      progress.episodeNumber < 0 ||
      typeof progress.episodesWatched !== "number" ||
      !Number.isInteger(progress.episodesWatched) ||
      progress.episodesWatched < 0
    ) {
      throw new MediaLibraryInvariantError("TV progress fields must be non-negative integers");
    }
  }

  if (candidate.episodeProgress !== undefined && candidate.episodeProgress !== null) {
    if (!Array.isArray(candidate.episodeProgress)) {
      throw new MediaLibraryInvariantError("episodeProgress must be an array");
    }
    if (
      candidate.mediaKind !== "anime" &&
      candidate.mediaKind !== "tv" &&
      candidate.episodeProgress.length > 0
    ) {
      throw new MediaLibraryInvariantError("Only anime and TV entries can carry episodeProgress");
    }
  }

  return input as MediaLibraryEntry;
}

/**
 * Validates the Phase 2A/2B library invariant before a hydrated media record
 * can be returned. Accepts unknown inputs, validates constraints, and preserves
 * nullable catalog metadata when valid library state exists.
 */
export function assertMediaLibraryItem(
  entryInput: unknown,
  mediaInput: unknown,
): asserts entryInput is MediaLibraryEntry {
  const entry = validateMediaLibraryEntry(entryInput);
  if (mediaInput === null || mediaInput === undefined) {
    return;
  }

  if (typeof mediaInput !== "object" || Array.isArray(mediaInput)) {
    throw new MediaLibraryInvariantError("Catalog media must be a non-null object or null");
  }
  const media = mediaInput as Record<string, unknown>;

  if (media.id !== entry.mediaId) {
    throw new MediaLibraryInvariantError(
      "Hydrated media ID does not match the library entry media ID",
    );
  }

  if (media.kind !== entry.mediaKind) {
    throw new MediaLibraryInvariantError(
      "Hydrated media kind does not match the library entry media kind",
    );
  }
}
