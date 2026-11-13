import { getDisplayTitle } from "@/lib/utils";
import type { CustomListItem, SmartListRule } from "@/types/custom-list";
import type { LibraryItem } from "@/types/library";
import type { TmdbLibraryItem } from "@/types/tmdb";

export interface SmartListPreset {
  key: string;
  title: string;
  description: string;
  rule: SmartListRule;
}

/** Ready-made rules offered when creating a collection. */
export const SMART_LIST_PRESETS: SmartListPreset[] = [
  {
    key: "top-rated-screen",
    title: "Films & TV I rated 8+",
    description: "Every film and series you scored eight or higher.",
    rule: { type: "score_min", min: 8, scope: "screen" },
  },
  {
    key: "unrated-anime",
    title: "Unrated anime & manga",
    description: "Titles you started or finished but never scored.",
    rule: { type: "unrated", scope: "anime" },
  },
  {
    key: "dropped",
    title: "Dropped",
    description: "Everything you set aside, across both catalogues.",
    rule: { type: "status", status: "dropped" },
  },
  {
    key: "unfinished",
    title: "Still unfinished",
    description: "Series with episodes left that you have not completed.",
    rule: { type: "unfinished" },
  },
];

export function smartRuleLabel(rule: SmartListRule): string {
  switch (rule.type) {
    case "score_min":
      return `Scored ${rule.min}+ · ${rule.scope === "screen" ? "films & TV" : "anime & manga"}`;
    case "unrated":
      return `Unrated · ${rule.scope === "screen" ? "films & TV" : "anime & manga"}`;
    case "status":
      return `Status · ${rule.status.replace("_", " ")}`;
    case "unfinished":
      return "Unfinished series";
  }
}

function animeItem(item: LibraryItem): CustomListItem {
  const anime = item.anime;
  return {
    id: `smart:anilist:${item.entry.anilistId}`,
    anilistId: item.entry.anilistId,
    title: anime ? getDisplayTitle(anime.title, true) : `AniList #${item.entry.anilistId}`,
    mediaType: item.entry.mediaType ?? anime?.mediaType ?? "anime",
    coverImage: anime ? (anime.coverImage.large ?? anime.coverImage.extraLarge) : null,
    format: anime?.format ?? null,
    averageScore: anime?.averageScore ?? null,
    addedAt: item.entry.updatedAt,
  };
}

function screenItem(item: TmdbLibraryItem): CustomListItem {
  return {
    id: `smart:tmdb:${item.entry.mediaType}:${item.entry.tmdbId}`,
    tmdbId: item.entry.tmdbId,
    tmdbKind: item.entry.mediaType,
    title: item.entry.title,
    coverImage: item.entry.posterPath,
    format: item.entry.mediaType === "tv" ? "TV" : "Film",
    averageScore: null,
    addedAt: item.entry.updatedAt,
  };
}

function byTitle(a: CustomListItem, b: CustomListItem): number {
  return a.title.localeCompare(b.title);
}

function byScoreThenTitle(a: CustomListItem, b: CustomListItem): number {
  return (b.averageScore ?? 0) - (a.averageScore ?? 0) || byTitle(a, b);
}

/**
 * Turns a rule into the items it currently selects. Pure: the same library
 * always produces the same list, so nothing needs to be stored.
 */
export function resolveSmartListItems(
  rule: SmartListRule,
  libraryItems: LibraryItem[],
  screenItems: TmdbLibraryItem[],
): CustomListItem[] {
  switch (rule.type) {
    case "score_min": {
      if (rule.scope === "screen") {
        return screenItems
          .filter((item) => item.entry.score !== null && item.entry.score >= rule.min)
          .map(screenItem)
          .sort(byTitle);
      }
      return libraryItems
        .filter((item) => item.entry.score !== null && item.entry.score >= rule.min)
        .map(animeItem)
        .sort(byScoreThenTitle);
    }
    case "unrated": {
      const unratedAnime = libraryItems
        .filter((item) => item.entry.score === null && item.entry.status !== "planning")
        .map(animeItem);
      if (rule.scope === "anime") return unratedAnime.sort(byTitle);
      const unratedScreen = screenItems
        .filter((item) => item.entry.score === null && item.entry.status !== "planning")
        .map(screenItem);
      return [...unratedAnime, ...unratedScreen].sort(byTitle);
    }
    case "status": {
      const anime = libraryItems
        .filter((item) => item.entry.status === rule.status)
        .map(animeItem);
      const screen = screenItems
        .filter((item) => item.entry.status === rule.status)
        .map(screenItem);
      return [...anime, ...screen].sort(byTitle);
    }
    case "unfinished": {
      const anime = libraryItems
        .filter(
          (item) =>
            item.entry.status === "watching" &&
            item.entry.mediaType !== "manga" &&
            item.anime?.episodes != null &&
            item.anime.episodes > 0 &&
            item.entry.progress < item.anime.episodes,
        )
        .map(animeItem);
      const series = screenItems
        .filter(
          (item) =>
            item.entry.mediaType === "tv" &&
            item.entry.status !== "completed" &&
            item.entry.status !== "dropped" &&
            item.entry.totalEpisodes != null &&
            item.entry.totalEpisodes > 0 &&
            item.watchedCount < item.entry.totalEpisodes,
        )
        .map(screenItem);
      return [...anime, ...series].sort(byTitle);
    }
  }
}

/** The items a collection should render, stored or computed. */
export function listItemsFor(
  list: { items: CustomListItem[]; rule?: SmartListRule | null },
  libraryItems: LibraryItem[],
  screenItems: TmdbLibraryItem[],
): CustomListItem[] {
  if (list.rule) {
    return resolveSmartListItems(list.rule, libraryItems, screenItems);
  }
  return list.items;
}
