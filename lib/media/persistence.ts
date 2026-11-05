import { createHash } from "node:crypto";

import { isWatchStatus } from "@/types/library";
import {
  toCanonicalMediaId,
  type CanonicalMediaId,
  type MediaKind,
  type MediaLibraryEntry,
  type MediaSummary,
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
  | "conflicting-media-kind-existing"
  | "orphan-episode"
  | "manga-episode-history"
  | "episode-parent-not-migrated"
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
    | { kind: "manga"; chaptersRead: number; volumesRead: number };
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

export interface BackfillOptions {
  /** Existing verified mappings, keyed by `provider:externalId`. */
  existingMappings?: ReadonlyMap<
    string,
    { mediaId: CanonicalMediaId; kind: MediaKind }
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

    const kind = canonicalKindForLegacyMediaType(row.mediaType);
    if (!kind) {
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

    if (!validProgressForKind(kind, row.progress, row.volumesProgress)) {
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

    const mediaId = deterministicAniListMediaId(row.anilistId);
    const mappingKey = legacyAniListMappingKey(row.anilistId);
    const existingMapping = options.existingMappings?.get(mappingKey);
    if (
      existingMapping &&
      (existingMapping.mediaId !== mediaId || existingMapping.kind !== kind)
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

    const existingMedia = mediaById.get(mediaId);
    if (existingMedia && existingMedia.kind !== kind) {
      addIssue({
        legacyTable: "user_anime",
        legacyId: row.id,
        reason: "conflicting-media-kind-existing",
        details: { anilistId: row.anilistId },
      });
      continue;
    }

    mediaById.set(mediaId, { id: mediaId, kind });
    externalIdsByKey.set(mappingKey, {
      mediaId,
      provider: "anilist",
      externalId: String(row.anilistId),
    });

    userMediaById.set(row.id, {
      id: row.id,
      userId: row.userId,
      mediaId,
      mediaKind: kind,
      status: row.status,
      progress:
        kind === "anime"
          ? { kind: "anime", episodesWatched: row.progress }
          : {
              kind: "manga",
              chaptersRead: row.progress,
              volumesRead: row.volumesProgress,
            },
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

  const legacyByUserAndAniList = new Map<
    string,
    LegacyUserAnimeRow
  >();
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

    if (!Number.isInteger(episode.episodeNumber) || episode.episodeNumber <= 0) {
      addIssue({
        legacyTable: "user_anime_episodes",
        legacyId: episode.id,
        reason: "invalid-progress",
        details: { episodeNumber: episode.episodeNumber },
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
      seasonNumber: 0,
      episodeNumber: episode.episodeNumber,
      watchedAt: episode.watchedAt,
      createdAt: episode.createdAt,
    });
  }

  return {
    media: [...mediaById.values()],
    externalIds: [...externalIdsByKey.values()],
    userMedia: [...userMediaById.values()],
    episodes: plannedEpisodes,
    issues,
  };
}

/**
 * Validates the Phase 2A/2B library invariant before a hydrated media record
 * can be returned. This module is intentionally not connected to runtime yet.
 */
export function assertMediaLibraryItem(
  entry: MediaLibraryEntry,
  media: MediaSummary | null,
): void {
  if (entry.progress.kind !== entry.mediaKind) {
    throw new MediaLibraryInvariantError(
      "Library entry progress kind does not match its media kind",
    );
  }
  if (media === null) return;
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
