import { todayIsoDate } from "@/lib/utils";
import {
  computeStatusTransition,
  isFiniteEpisodeCount,
  validateProgressAgainstEpisodes,
} from "@/lib/validation/library";
import type { LibraryEntry, WatchStatus } from "@/types/library";

export class LibraryProgressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LibraryProgressError";
  }
}

export interface LibraryEntryPatch {
  status?: WatchStatus;
  progress?: number;
  score?: number | null;
  notes?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

/**
 * Applies an update to an existing entry without discarding user data.
 *
 * Rules:
 * - Progress is validated against the provider episode count when known.
 * - Status changes preserve rating, notes and progress.
 * - Completing an entry fills progress to the known episode count; an
 *   explicitly supplied progress value always wins.
 * - Leaving the completed status clears `completedAt`, so an accidental
 *   completion can be reversed.
 */
export function applyLibraryEntryUpdate(
  current: LibraryEntry,
  patch: LibraryEntryPatch,
  episodes: number | null,
  today: string = todayIsoDate(),
): LibraryEntryPatch {
  const next: LibraryEntryPatch = { ...patch };

  if (patch.progress !== undefined) {
    if (!Number.isInteger(patch.progress) || patch.progress < 0) {
      throw new LibraryProgressError(
        "Progress must be a non-negative whole number",
      );
    }
    const validation = validateProgressAgainstEpisodes(
      patch.progress,
      episodes,
    );
    if (!validation.ok) {
      throw new LibraryProgressError(
        validation.message ?? "Progress is outside the allowed range",
      );
    }
  }

  if (patch.status !== undefined) {
    const transition = computeStatusTransition(current, patch.status, today);
    next.startedAt = transition.startedAt;
    next.completedAt = transition.completedAt;

    if (
      patch.status === "completed" &&
      patch.progress === undefined &&
      isFiniteEpisodeCount(episodes)
    ) {
      next.progress = episodes;
    }
  }

  return next;
}
