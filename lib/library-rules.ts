import { todayIsoDate } from "@/lib/utils";
import {
  computeStatusTransition,
  isFiniteEpisodeCount,
  validateProgressAgainstTotal,
  validateVolumesProgress,
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
  volumesProgress?: number;
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
  totalVolumes: number | null = null,
): LibraryEntryPatch {
  const next: LibraryEntryPatch = { ...patch };
  const unit = current.mediaType === "manga" ? "chapter" : "episode";

  if (patch.progress !== undefined) {
    const validation = validateProgressAgainstTotal(
      patch.progress,
      episodes,
      unit,
    );
    if (!validation.ok) {
      throw new LibraryProgressError(
        validation.message ?? "Progress is outside the allowed range",
      );
    }
  }

  if (patch.volumesProgress !== undefined) {
    const validation = validateVolumesProgress(
      patch.volumesProgress,
      totalVolumes,
    );
    if (!validation.ok) {
      throw new LibraryProgressError(
        validation.message ?? "Volume progress is outside the allowed range",
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
