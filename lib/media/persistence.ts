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
  | "conflicting-library-favorite"
  | "conflicting-library-rewatch-count"
  | "conflicting-library-dates"
  | "conflicting-library-timestamps"
  | "conflicting-alternate-key-library"
  | "orphan-episode"
  | "manga-episode-history"
  | "movie-episode-history"
  | "episode-parent-not-migrated"
  | "conflicting-episode-user-ownership"
  | "conflicting-episode-parent"
  | "conflicting-episode-number"
  | "conflicting-episode-watched-at"
  | "conflicting-episode-created-at"
  | "conflicting-alternate-key-episode"
  | "duplicate-episode";

export interface BackfillIssue {
  legacyTable: "user_anime" | "user_anime_episodes";
  legacyId: string;
  reason: BackfillIssueReason;
  details: Record<string, string | number | null>;
}

export interface BackfillIssueRecord {
  id?: string;
  runId: string;
  legacyTable: string;
  legacyId: string;
  reason: string;
  details?: Record<string, unknown>;
  createdAt?: string;
  resolvedAt?: string | null;
}

export interface BackfillRunRecord {
  id: string;
  startedAt: string;
  completedAt?: string | null;
  outcome: "running" | "completed" | "failed";
  details?: Record<string, unknown>;
}

export interface Phase2bValidationIssueSummary {
  latestRunId: string | null;
  totalHistorical: number;
  unresolved: number;
  resolved: number;
  latestRunTotal: number;
  latestRunUnresolved: number;
}

export function summarizeBackfillIssues(
  issues: readonly BackfillIssueRecord[],
  runs?: readonly BackfillRunRecord[],
): Phase2bValidationIssueSummary {
  // Derive latest run from media_backfill_runs ledger, supporting zero-issue runs
  let latestRunId: string | null = null;
  if (runs && runs.length > 0) {
    const sortedRuns = [...runs].sort((a, b) => {
      const timeA = new Date(a.startedAt).getTime();
      const timeB = new Date(b.startedAt).getTime();
      return timeB - timeA;
    });
    latestRunId = sortedRuns[0]?.id ?? null;
  }

  let unresolved = 0;
  let resolved = 0;
  let latestRunTotal = 0;
  let latestRunUnresolved = 0;

  for (const issue of issues) {
    const isResolved =
      issue.resolvedAt !== null && issue.resolvedAt !== undefined;
    if (isResolved) {
      resolved++;
    } else {
      unresolved++;
    }

    if (latestRunId && issue.runId === latestRunId) {
      latestRunTotal++;
      if (!isResolved) {
        latestRunUnresolved++;
      }
    }
  }

  return {
    latestRunId,
    totalHistorical: issues.length,
    unresolved,
    resolved,
    latestRunTotal,
    latestRunUnresolved,
  };
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
  favorite?: boolean;
  notes?: string | null;
  rewatchCount?: number;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExistingEpisodeRow {
  id: string;
  userId: string;
  userMediaId: string;
  mediaKind?: "anime" | "tv";
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: string;
  createdAt?: string;
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

const ALL_SUPPORTED_FORMATS = new Set([
  "TV",
  "TV_SHORT",
  "MOVIE",
  "OVA",
  "ONA",
  "SPECIAL",
  "MUSIC",
  "MANGA",
  "ONE_SHOT",
  "NOVEL",
]);

interface ExtractedCacheFormat {
  status: "ok" | "missing" | "malformed" | "conflicting";
  format?: string;
}

function extractCandidateFormat(item: unknown): string | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  let rawFmt: unknown = undefined;
  if ("format" in record) {
    rawFmt = record.format;
  } else if (
    record.payload &&
    typeof record.payload === "object" &&
    "format" in record.payload
  ) {
    rawFmt = (record.payload as Record<string, unknown>).format;
  }
  if (typeof rawFmt === "string" && rawFmt.trim().length > 0) {
    const cleaned = rawFmt.trim().toUpperCase();
    if (ALL_SUPPORTED_FORMATS.has(cleaned)) {
      return cleaned;
    }
  }
  return null;
}

export function resolveCacheFormat(
  anilistId: number,
  cache?: BackfillOptions["catalogCache"],
): ExtractedCacheFormat {
  if (!cache || cache.size === 0) {
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

  const items: unknown[] = [];
  for (const c of candidates) {
    if (Array.isArray(c)) {
      items.push(...c);
    } else {
      items.push(c);
    }
  }

  if (items.length === 0) {
    return { status: "missing" };
  }

  const validFormats = new Set<string>();
  let hasMalformed = false;

  for (const item of items) {
    if (!item || typeof item !== "object") {
      hasMalformed = true;
      continue;
    }
    const fmt = extractCandidateFormat(item);
    if (!fmt) {
      hasMalformed = true;
    } else {
      validFormats.add(fmt);
    }
  }

  // If ANY item was malformed, missing, empty, or unrecognised, quarantine as malformed
  if (hasMalformed) {
    return { status: "malformed" };
  }

  // If multiple distinct valid formats exist
  if (validFormats.size > 1) {
    return { status: "conflicting" };
  }

  if (validFormats.size === 0) {
    return { status: "malformed" };
  }

  const format = [...validFormats][0]!;
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
  const newlyPlannedUserMediaIds = new Set<string>();
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
    const existingById = options.existingUserMedia?.get(row.id);
    const existingByAlternateKey = options.existingUserMedia?.get(`${row.userId}:${mediaId}`);

    if (existingById) {
      if (existingById.userId !== row.userId) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-user-ownership",
          details: {
            libraryId: existingById.id,
            existingUserId: existingById.userId,
            attemptedUserId: row.userId,
          },
        });
        continue;
      }

      if (existingById.mediaId !== mediaId) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-media-id",
          details: {
            libraryId: existingById.id,
            existingMediaId: existingById.mediaId,
            attemptedMediaId: mediaId,
          },
        });
        continue;
      }

      if (existingById.mediaKind !== targetKind) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-media-kind",
          details: {
            libraryId: existingById.id,
            existingMediaKind: existingById.mediaKind,
            attemptedMediaKind: targetKind,
          },
        });
        continue;
      }

      if (existingById.status !== row.status) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-status",
          details: {
            libraryId: existingById.id,
            existingStatus: existingById.status,
            attemptedStatus: row.status,
          },
        });
        continue;
      }

      let progressConflicts = false;
      if (targetKind === "anime") {
        progressConflicts =
          existingById.progress.kind !== "anime" ||
          existingById.progress.episodesWatched !== row.progress;
      } else if (targetKind === "manga") {
        progressConflicts =
          existingById.progress.kind !== "manga" ||
          existingById.progress.chaptersRead !== row.progress ||
          existingById.progress.volumesRead !== row.volumesProgress;
      } else if (targetKind === "movie") {
        const targetWatched = row.status === "completed" || row.progress >= 1;
        progressConflicts =
          existingById.progress.kind !== "movie" ||
          existingById.progress.watched !== targetWatched;
      }

      if (progressConflicts) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-progress",
          details: {
            libraryId: existingById.id,
            progress: row.progress,
          },
        });
        continue;
      }

      if (existingById.score !== row.score) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-score",
          details: {
            libraryId: existingById.id,
            existingScore: existingById.score,
            attemptedScore: row.score,
          },
        });
        continue;
      }

      if (
        existingById.notes !== undefined &&
        existingById.notes !== row.notes
      ) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-notes",
          details: {
            libraryId: existingById.id,
          },
        });
        continue;
      }

      if (existingById.favorite !== undefined && existingById.favorite !== false) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-favorite",
          details: {
            libraryId: existingById.id,
          },
        });
        continue;
      }

      if (existingById.rewatchCount !== undefined && existingById.rewatchCount !== 0) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-rewatch-count",
          details: {
            libraryId: existingById.id,
          },
        });
        continue;
      }

      if (
        (existingById.startedAt !== undefined && existingById.startedAt !== row.startedAt) ||
        (existingById.completedAt !== undefined && existingById.completedAt !== row.completedAt)
      ) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-dates",
          details: {
            libraryId: existingById.id,
          },
        });
        continue;
      }

      if (
        (existingById.createdAt !== undefined && existingById.createdAt !== row.createdAt) ||
        (existingById.updatedAt !== undefined && existingById.updatedAt !== row.updatedAt)
      ) {
        addIssue({
          legacyTable: "user_anime",
          legacyId: row.id,
          reason: "conflicting-library-timestamps",
          details: {
            libraryId: existingById.id,
          },
        });
        continue;
      }

      // If existing user media matches identically, this is an idempotent rerun.
      // We don't re-insert, but record in userMediaById for parent episode lookup.
      userMediaById.set(row.id, {
        id: existingById.id,
        userId: existingById.userId,
        mediaId: existingById.mediaId,
        mediaKind: existingById.mediaKind,
        status: existingById.status,
        progress: existingById.progress,
        score: existingById.score,
        favorite: false,
        notes: existingById.notes ?? null,
        rewatchCount: 0,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      });
      continue;
    }

    if (existingByAlternateKey && existingByAlternateKey.id !== row.id) {
      let progressConflicts = false;
      if (targetKind === "anime") {
        progressConflicts =
          existingByAlternateKey.progress.kind !== "anime" ||
          existingByAlternateKey.progress.episodesWatched !== row.progress;
      } else if (targetKind === "manga") {
        progressConflicts =
          existingByAlternateKey.progress.kind !== "manga" ||
          existingByAlternateKey.progress.chaptersRead !== row.progress ||
          existingByAlternateKey.progress.volumesRead !== row.volumesProgress;
      } else if (targetKind === "movie") {
        const targetWatched = row.status === "completed" || row.progress >= 1;
        progressConflicts =
          existingByAlternateKey.progress.kind !== "movie" ||
          existingByAlternateKey.progress.watched !== targetWatched;
      }

      const isIdentical =
        existingByAlternateKey.userId === row.userId &&
        existingByAlternateKey.mediaId === mediaId &&
        existingByAlternateKey.mediaKind === targetKind &&
        existingByAlternateKey.status === row.status &&
        !progressConflicts &&
        existingByAlternateKey.score === row.score &&
        (existingByAlternateKey.notes === undefined || existingByAlternateKey.notes === row.notes) &&
        (existingByAlternateKey.favorite === undefined || existingByAlternateKey.favorite === false) &&
        (existingByAlternateKey.rewatchCount === undefined || existingByAlternateKey.rewatchCount === 0) &&
        (existingByAlternateKey.startedAt === undefined || existingByAlternateKey.startedAt === row.startedAt) &&
        (existingByAlternateKey.completedAt === undefined || existingByAlternateKey.completedAt === row.completedAt) &&
        (existingByAlternateKey.createdAt === undefined || existingByAlternateKey.createdAt === row.createdAt) &&
        (existingByAlternateKey.updatedAt === undefined || existingByAlternateKey.updatedAt === row.updatedAt);

      if (isIdentical) {
        // Different primary UUID, same alternate key (user_id, media_id), identical fields:
        // Idempotent match, not a conflict.
        // Record in userMediaById using the existing ID so child episodes can resolve their parent.
        userMediaById.set(row.id, {
          id: existingByAlternateKey.id,
          userId: existingByAlternateKey.userId,
          mediaId: existingByAlternateKey.mediaId,
          mediaKind: existingByAlternateKey.mediaKind,
          status: existingByAlternateKey.status,
          progress: existingByAlternateKey.progress,
          score: existingByAlternateKey.score,
          favorite: false,
          notes: existingByAlternateKey.notes ?? null,
          rewatchCount: 0,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        });
        continue;
      }

      addIssue({
        legacyTable: "user_anime",
        legacyId: row.id,
        reason: "conflicting-alternate-key-library",
        details: {
          libraryId: row.id,
          existingId: existingByAlternateKey.id,
        },
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

    newlyPlannedUserMediaIds.add(row.id);
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
    const existingById = options.existingEpisodes?.get(episode.id);
    const existingByAlternateKey = options.existingEpisodes?.get(`${userMedia.id}:0:${episode.episodeNumber}`);

    if (existingById) {
      if (existingById.userId !== episode.userId) {
        addIssue({
          legacyTable: "user_anime_episodes",
          legacyId: episode.id,
          reason: "conflicting-episode-user-ownership",
          details: {
            episodeId: existingById.id,
            existingUserId: existingById.userId,
            attemptedUserId: episode.userId,
          },
        });
        continue;
      }

      if (existingById.userMediaId !== userMedia.id) {
        addIssue({
          legacyTable: "user_anime_episodes",
          legacyId: episode.id,
          reason: "conflicting-episode-parent",
          details: {
            episodeId: existingById.id,
            existingParentId: existingById.userMediaId,
            attemptedParentId: userMedia.id,
          },
        });
        continue;
      }

      if (existingById.seasonNumber !== 0 || existingById.episodeNumber !== episode.episodeNumber) {
        addIssue({
          legacyTable: "user_anime_episodes",
          legacyId: episode.id,
          reason: "conflicting-episode-number",
          details: {
            episodeId: existingById.id,
            existingNumber: existingById.episodeNumber,
            attemptedNumber: episode.episodeNumber,
          },
        });
        continue;
      }

      if (existingById.watchedAt !== episode.watchedAt) {
        addIssue({
          legacyTable: "user_anime_episodes",
          legacyId: episode.id,
          reason: "conflicting-episode-watched-at",
          details: {
            episodeId: existingById.id,
            existingWatchedAt: existingById.watchedAt,
            attemptedWatchedAt: episode.watchedAt,
          },
        });
        continue;
      }

      if (existingById.createdAt !== undefined && existingById.createdAt !== episode.createdAt) {
        addIssue({
          legacyTable: "user_anime_episodes",
          legacyId: episode.id,
          reason: "conflicting-episode-created-at",
          details: {
            episodeId: existingById.id,
            existingCreatedAt: existingById.createdAt,
            attemptedCreatedAt: episode.createdAt,
          },
        });
        continue;
      }

      // Identical rerun -> skip insert without issue
      continue;
    }

    if (existingByAlternateKey && existingByAlternateKey.id !== episode.id) {
      const isIdentical =
        existingByAlternateKey.userId === episode.userId &&
        existingByAlternateKey.userMediaId === userMedia.id &&
        existingByAlternateKey.seasonNumber === 0 &&
        existingByAlternateKey.episodeNumber === episode.episodeNumber &&
        existingByAlternateKey.watchedAt === episode.watchedAt &&
        (existingByAlternateKey.createdAt === undefined || existingByAlternateKey.createdAt === episode.createdAt);

      if (isIdentical) {
        // Different primary UUID, same alternate key (user_media_id, 0, episode_number), identical fields:
        // Idempotent match, not a conflict.
        continue;
      }

      addIssue({
        legacyTable: "user_anime_episodes",
        legacyId: episode.id,
        reason: "conflicting-alternate-key-episode",
        details: {
          episodeId: episode.id,
          existingId: existingByAlternateKey.id,
        },
      });
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
    (row) =>
      newlyPlannedUserMediaIds.has(row.id) &&
      !options.existingUserMedia?.has(row.id) &&
      !options.existingUserMedia?.has(`${row.userId}:${row.mediaId}`),
  );

  return {
    media: [...mediaById.values()],
    externalIds: [...externalIdsByKey.values()],
    userMedia: newlyPlannedUserMedia,
    episodes: plannedEpisodes,
    issues,
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value.trim());
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

  if (!isValidUuid(candidate.id)) {
    throw new MediaLibraryInvariantError("Library entry ID must be a valid UUID");
  }

  if (!isValidUuid(candidate.userId)) {
    throw new MediaLibraryInvariantError("Library entry userId must be a valid UUID");
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
      !Number.isFinite(candidate.score) ||
      !Number.isInteger(candidate.score) ||
      candidate.score < 1 ||
      candidate.score > 10
    ) {
      throw new MediaLibraryInvariantError("Score must be null or an integer between 1 and 10");
    }
  }

  if (
    typeof candidate.rewatchCount !== "number" ||
    !Number.isFinite(candidate.rewatchCount) ||
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

  if (candidate.startedAt !== null && candidate.startedAt !== undefined) {
    if (typeof candidate.startedAt !== "string" || Number.isNaN(Date.parse(candidate.startedAt))) {
      throw new MediaLibraryInvariantError("startedAt must be a valid date string or null");
    }
  }

  if (candidate.completedAt !== null && candidate.completedAt !== undefined) {
    if (typeof candidate.completedAt !== "string" || Number.isNaN(Date.parse(candidate.completedAt))) {
      throw new MediaLibraryInvariantError("completedAt must be a valid date string or null");
    }
  }

  if (typeof candidate.createdAt !== "string" || Number.isNaN(Date.parse(candidate.createdAt))) {
    throw new MediaLibraryInvariantError("createdAt must be a valid timestamp string");
  }

  if (typeof candidate.updatedAt !== "string" || Number.isNaN(Date.parse(candidate.updatedAt))) {
    throw new MediaLibraryInvariantError("updatedAt must be a valid timestamp string");
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
      !Number.isFinite(progress.episodesWatched) ||
      !Number.isInteger(progress.episodesWatched) ||
      progress.episodesWatched < 0
    ) {
      throw new MediaLibraryInvariantError("Anime episodesWatched must be a non-negative integer");
    }
  } else if (candidate.mediaKind === "manga") {
    if (
      typeof progress.chaptersRead !== "number" ||
      !Number.isFinite(progress.chaptersRead) ||
      !Number.isInteger(progress.chaptersRead) ||
      progress.chaptersRead < 0 ||
      typeof progress.volumesRead !== "number" ||
      !Number.isFinite(progress.volumesRead) ||
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
      !Number.isFinite(progress.seasonNumber) ||
      !Number.isInteger(progress.seasonNumber) ||
      progress.seasonNumber < 0 ||
      typeof progress.episodeNumber !== "number" ||
      !Number.isFinite(progress.episodeNumber) ||
      !Number.isInteger(progress.episodeNumber) ||
      progress.episodeNumber < 0 ||
      typeof progress.episodesWatched !== "number" ||
      !Number.isFinite(progress.episodesWatched) ||
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
    for (const ep of candidate.episodeProgress) {
      if (!ep || typeof ep !== "object" || Array.isArray(ep)) {
        throw new MediaLibraryInvariantError("Episode progress items must be non-null objects");
      }
      const epRecord = ep as Record<string, unknown>;
      if (
        typeof epRecord.seasonNumber !== "number" ||
        !Number.isFinite(epRecord.seasonNumber) ||
        !Number.isInteger(epRecord.seasonNumber) ||
        epRecord.seasonNumber < 0
      ) {
        throw new MediaLibraryInvariantError("Episode seasonNumber must be a non-negative integer");
      }
      if (
        typeof epRecord.episodeNumber !== "number" ||
        !Number.isFinite(epRecord.episodeNumber) ||
        !Number.isInteger(epRecord.episodeNumber) ||
        epRecord.episodeNumber <= 0
      ) {
        throw new MediaLibraryInvariantError("Episode episodeNumber must be a positive integer");
      }
      if (epRecord.watchedAt !== null && epRecord.watchedAt !== undefined) {
        if (typeof epRecord.watchedAt !== "string" || Number.isNaN(Date.parse(epRecord.watchedAt))) {
          throw new MediaLibraryInvariantError("Episode watchedAt must be a valid date string or null");
        }
      }
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
