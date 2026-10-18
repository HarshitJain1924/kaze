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

export const LIBRARY_SORT_LABELS = {
  recent: "Recently updated",
  title: "Title",
  score: "Your rating",
  progress: "Progress",
} as const;
