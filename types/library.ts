import type { AnimeSummary } from "@/types/anime";

export const WATCH_STATUSES = [
  "watching",
  "completed",
  "planning",
  "on_hold",
  "dropped",
] as const;

export type WatchStatus = (typeof WATCH_STATUSES)[number];

export function isWatchStatus(value: unknown): value is WatchStatus {
  return (
    typeof value === "string" &&
    (WATCH_STATUSES as readonly string[]).includes(value)
  );
}

export interface LibraryEntry {
  id: string;
  userId: string;
  anilistId: number;
  status: WatchStatus;
  progress: number;
  score: number | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryItem {
  entry: LibraryEntry;
  /** Null when AniList metadata could not be loaded; the entry is preserved. */
  anime: AnimeSummary | null;
}

export type LibrarySort = "recent" | "title" | "score" | "progress";

export type LibraryView = "grid" | "list";

export const MIN_SCORE = 1;
export const MAX_SCORE = 10;
export const MAX_NOTES_LENGTH = 5000;
