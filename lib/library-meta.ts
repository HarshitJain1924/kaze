import type { MediaType } from "@/types/anime";
import type { WatchStatus } from "@/types/library";

interface WatchStatusMeta {
  label: string;
  shortLabel: string;
  description: string;
  color: string;
  emptyTitle: string;
  emptyBody: string;
}

export const WATCH_STATUS_META: Record<WatchStatus, WatchStatusMeta> = {
  watching: {
    label: "Watching",
    shortLabel: "Watching",
    description: "Currently working through episodes",
    color: "var(--status-watching)",
    emptyTitle: "Nothing in progress",
    emptyBody:
      "Start an anime from your planning list to see it here, or add something new from Discover.",
  },
  completed: {
    label: "Completed",
    shortLabel: "Completed",
    description: "Finished series",
    color: "var(--status-completed)",
    emptyTitle: "No completed anime yet",
    emptyBody:
      "When you finish a series, mark it completed to build your personal record.",
  },
  planning: {
    label: "Planning to Watch",
    shortLabel: "Planning",
    description: "Saved for later",
    color: "var(--status-planning)",
    emptyTitle: "Your watchlist is empty",
    emptyBody:
      "Find something in Discover and add it to your library to plan your next watch.",
  },
  on_hold: {
    label: "On Hold",
    shortLabel: "On hold",
    description: "Paused for now",
    color: "var(--status-on-hold)",
    emptyTitle: "Nothing on hold",
    emptyBody:
      "Paused series will appear here so you can pick them up again later.",
  },
  dropped: {
    label: "Dropped",
    shortLabel: "Dropped",
    description: "Series you stopped watching",
    color: "var(--status-dropped)",
    emptyTitle: "No dropped anime",
    emptyBody:
      "Series you decide not to finish can be kept here without losing your notes.",
  },
};

export const WATCH_STATUS_ORDER: WatchStatus[] = [
  "watching",
  "planning",
  "on_hold",
  "completed",
  "dropped",
];

/** Manga uses reading language while keeping the same stored status values. */
export const MANGA_STATUS_META: Record<WatchStatus, WatchStatusMeta> = {
  ...WATCH_STATUS_META,
  watching: {
    ...WATCH_STATUS_META.watching,
    label: "Reading",
    shortLabel: "Reading",
    description: "Currently reading chapters",
    emptyTitle: "Nothing in progress",
    emptyBody:
      "Start a manga from your plan-to-read list, or add one from Discover.",
  },
  completed: {
    ...WATCH_STATUS_META.completed,
    description: "Finished reading",
    emptyTitle: "No completed manga yet",
    emptyBody:
      "When you finish a manga or manhwa, mark it completed to build your record.",
  },
  planning: {
    ...WATCH_STATUS_META.planning,
    label: "Plan to Read",
    shortLabel: "Plan to read",
    description: "Saved for later",
    emptyTitle: "Your reading list is empty",
    emptyBody:
      "Find a manga or manhwa in Discover and add it to your plan-to-read list.",
  },
  on_hold: {
    ...WATCH_STATUS_META.on_hold,
    description: "Paused for now",
    emptyTitle: "Nothing on hold",
    emptyBody:
      "Paused manga will appear here so you can pick them up again later.",
  },
  dropped: {
    ...WATCH_STATUS_META.dropped,
    description: "Manga you stopped reading",
    emptyTitle: "No dropped manga",
    emptyBody:
      "Manga you decide not to finish can be kept here without losing your notes.",
  },
};

export function getWatchStatusMeta(
  mediaType?: MediaType,
): Record<WatchStatus, WatchStatusMeta> {
  return mediaType === "manga" ? MANGA_STATUS_META : WATCH_STATUS_META;
}

export function getWatchStatusLabel(
  status: WatchStatus,
  mediaType?: MediaType,
): string {
  return getWatchStatusMeta(mediaType)[status].label;
}

export const LIBRARY_SORT_LABELS = {
  recent: "Recently updated",
  title: "Title",
  score: "Your rating",
  progress: "Progress",
} as const;
