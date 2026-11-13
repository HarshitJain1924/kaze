import { getDisplayTitle } from "@/lib/utils";
import type { LibraryItem, WatchedEpisode } from "@/types/library";
import type {
  TmdbKind,
  TmdbLibraryEntry,
  TmdbLibraryItem,
  TmdbWatchedEpisode,
} from "@/types/tmdb";

export type ActivityUndo =
  | { type: "anime_episode"; anilistId: number; episodeNumber: number }
  | {
      type: "screen_episode";
      kind: TmdbKind;
      tmdbId: number;
      seasonNumber: number;
      episodeNumber: number;
    };

export type ActivityKind = "anime_episode" | "screen_episode" | "completed";

export interface ActivityEvent {
  id: string;
  /** ISO timestamp of when the action happened. */
  at: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  href: string;
  undo: ActivityUndo | null;
}

export interface ActivityMonth {
  /** `YYYY-MM`, stable across renders. */
  key: string;
  label: string;
  events: ActivityEvent[];
  episodeCount: number;
  completionCount: number;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const DAY_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function formatActivityDay(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : DAY_FORMAT.format(date);
}

export function formatActivityMonth(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : MONTH_FORMAT.format(date);
}

function screenHref(kind: TmdbKind, tmdbId: number): string {
  return `/screen/${kind}/${tmdbId}`;
}

function episodeLabel(seasonNumber: number, episodeNumber: number): string {
  return seasonNumber > 0
    ? `Season ${seasonNumber} · Episode ${episodeNumber}`
    : `Episode ${episodeNumber}`;
}

export function buildActivityEvents({
  libraryItems,
  animeEpisodes,
  screenEntries,
  screenEpisodes,
  limit = 300,
}: {
  libraryItems: LibraryItem[];
  animeEpisodes: WatchedEpisode[];
  screenEntries: TmdbLibraryEntry[];
  screenEpisodes: TmdbWatchedEpisode[];
  limit?: number;
}): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  const animeById = new Map(
    libraryItems.map((item) => [item.entry.anilistId, item]),
  );

  for (const episode of animeEpisodes) {
    const item = animeById.get(episode.anilistId);
    const title = item?.anime
      ? getDisplayTitle(item.anime.title, true)
      : `AniList #${episode.anilistId}`;
    events.push({
      id: `anime-episode-${episode.id}`,
      at: episode.watchedAt,
      kind: "anime_episode",
      title,
      detail: `Episode ${episode.episodeNumber}`,
      href: `/media/${episode.anilistId}`,
      undo: {
        type: "anime_episode",
        anilistId: episode.anilistId,
        episodeNumber: episode.episodeNumber,
      },
    });
  }

  const screenEntryById = new Map(
    screenEntries.map((entry) => [entry.id, entry]),
  );
  for (const episode of screenEpisodes) {
    const entry = screenEntryById.get(episode.entryId);
    if (!entry) continue;
    events.push({
      id: `screen-episode-${episode.id}`,
      at: episode.watchedAt,
      kind: "screen_episode",
      title: entry.title,
      detail: episodeLabel(episode.seasonNumber, episode.episodeNumber),
      href: screenHref(entry.mediaType, entry.tmdbId),
      undo: {
        type: "screen_episode",
        kind: entry.mediaType,
        tmdbId: entry.tmdbId,
        seasonNumber: episode.seasonNumber,
        episodeNumber: episode.episodeNumber,
      },
    });
  }

  for (const item of libraryItems) {
    if (!item.entry.completedAt) continue;
    events.push({
      id: `anime-completed-${item.entry.id}`,
      at: item.entry.completedAt,
      kind: "completed",
      title: item.anime
        ? getDisplayTitle(item.anime.title, true)
        : `AniList #${item.entry.anilistId}`,
      detail:
        item.entry.mediaType === "manga" ? "Marked as read" : "Marked as completed",
      href: `/media/${item.entry.anilistId}`,
      undo: null,
    });
  }

  for (const entry of screenEntries) {
    if (!entry.completedAt) continue;
    events.push({
      id: `screen-completed-${entry.id}`,
      at: entry.completedAt,
      kind: "completed",
      title: entry.title,
      detail:
        entry.mediaType === "movie" ? "Film logged" : "Series completed",
      href: screenHref(entry.mediaType, entry.tmdbId),
      undo: null,
    });
  }

  return events
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
    .slice(0, limit);
}

/** Reverse-chronological months, each with its own episode and completion tally. */
export function groupActivityByMonth(events: ActivityEvent[]): ActivityMonth[] {
  const months = new Map<string, ActivityMonth>();

  for (const event of events) {
    const key = monthKey(event.at);
    let month = months.get(key);
    if (!month) {
      month = {
        key,
        label: formatActivityMonth(event.at),
        events: [],
        episodeCount: 0,
        completionCount: 0,
      };
      months.set(key, month);
    }
    month.events.push(event);
    if (event.kind === "completed") {
      month.completionCount += 1;
    } else {
      month.episodeCount += 1;
    }
  }

  return [...months.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}

/** The one-line tally used as a month heading, e.g. `14 episodes · 2 completions`. */
export function monthSummary(month: ActivityMonth): string {
  const parts: string[] = [];
  if (month.episodeCount > 0) {
    parts.push(
      `${month.episodeCount} ${month.episodeCount === 1 ? "episode" : "episodes"}`,
    );
  }
  if (month.completionCount > 0) {
    parts.push(
      `${month.completionCount} ${month.completionCount === 1 ? "completion" : "completions"}`,
    );
  }
  return parts.join(" · ");
}

export type { TmdbLibraryItem };
