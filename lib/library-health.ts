import { getDisplayTitle } from "@/lib/utils";
import type { LibraryItem } from "@/types/library";
import type { TmdbLibraryItem } from "@/types/tmdb";

export interface HealthFinding {
  id: string;
  title: string;
  detail: string;
  href: string;
}

/**
 * Structural problems in a library that the user can only fix by hand:
 * progress beyond a known total, titles whose provider count is unknown,
 * rows whose metadata never loaded, and duplicate catalogue ids. Read-only —
 * nothing here mutates data.
 */
export interface LibraryHealthReport {
  overrun: HealthFinding[];
  missingTotals: HealthFinding[];
  unhydrated: HealthFinding[];
  duplicates: HealthFinding[];
  /** True when every check came back clean. */
  clean: boolean;
  total: number;
}

function animeTotal(item: LibraryItem): number | null {
  if (item.entry.mediaType === "manga") {
    return item.anime?.chapters ?? null;
  }
  return item.anime?.episodes ?? null;
}

function animeTitle(item: LibraryItem): string {
  return item.anime
    ? getDisplayTitle(item.anime.title, true)
    : `AniList #${item.entry.anilistId}`;
}

export function computeLibraryHealth(
  libraryItems: LibraryItem[],
  screenItems: TmdbLibraryItem[],
): LibraryHealthReport {
  const overrun: HealthFinding[] = [];
  const missingTotals: HealthFinding[] = [];
  const unhydrated: HealthFinding[] = [];
  const duplicates: HealthFinding[] = [];

  for (const item of libraryItems) {
    const unit = item.entry.mediaType === "manga" ? "chapters" : "episodes";
    const total = animeTotal(item);

    if (total !== null && total > 0 && item.entry.progress > total) {
      overrun.push({
        id: `overrun-anilist-${item.entry.anilistId}`,
        title: animeTitle(item),
        detail: `${item.entry.progress} ${unit} recorded against a total of ${total}`,
        href: `/media/${item.entry.anilistId}`,
      });
    }

    // A missing total only means something when metadata actually loaded;
    // otherwise it is the same failure as `unhydrated` below.
    if (item.anime && item.entry.mediaType !== "manga" && (total === null || total === 0)) {
      missingTotals.push({
        id: `missing-anilist-${item.entry.anilistId}`,
        title: animeTitle(item),
        detail: "AniList reports no episode total, so completion cannot be verified.",
        href: `/media/${item.entry.anilistId}`,
      });
    }

    if (!item.anime) {
      unhydrated.push({
        id: `unhydrated-anilist-${item.entry.anilistId}`,
        title: animeTitle(item),
        detail: "Catalogue metadata did not load; progress and notes are still safe.",
        href: `/media/${item.entry.anilistId}`,
      });
    }
  }

  const seenAnime = new Map<number, number>();
  for (const item of libraryItems) {
    seenAnime.set(
      item.entry.anilistId,
      (seenAnime.get(item.entry.anilistId) ?? 0) + 1,
    );
  }
  for (const [anilistId, count] of seenAnime) {
    if (count > 1) {
      duplicates.push({
        id: `duplicate-anilist-${anilistId}`,
        title: `AniList #${anilistId}`,
        detail: `${count} rows share this catalogue id`,
        href: `/media/${anilistId}`,
      });
    }
  }

  const seenScreen = new Map<string, number>();
  for (const item of screenItems) {
    const key = `${item.entry.mediaType}:${item.entry.tmdbId}`;
    seenScreen.set(key, (seenScreen.get(key) ?? 0) + 1);

    if (
      item.entry.mediaType === "tv" &&
      item.entry.totalEpisodes != null &&
      item.entry.totalEpisodes > 0 &&
      item.watchedCount > item.entry.totalEpisodes
    ) {
      overrun.push({
        id: `overrun-tmdb-${key}`,
        title: item.entry.title,
        detail: `${item.watchedCount} episodes recorded against a total of ${item.entry.totalEpisodes}`,
        href: `/screen/${item.entry.mediaType}/${item.entry.tmdbId}`,
      });
    }
  }
  for (const [key, count] of seenScreen) {
    if (count > 1) {
      const [kind, ...rest] = key.split(":");
      duplicates.push({
        id: `duplicate-tmdb-${key}`,
        title: `TMDB #${rest.join(":")}`,
        detail: `${count} rows share this ${kind === "tv" ? "series" : "film"} id`,
        href: `/screen/${kind}/${rest.join(":")}`,
      });
    }
  }

  const unique = (findings: HealthFinding[]): HealthFinding[] => {
    const seen = new Set<string>();
    return findings.filter((finding) => {
      if (seen.has(finding.id)) return false;
      seen.add(finding.id);
      return true;
    });
  };

  const uniqueOverrun = unique(overrun);
  const uniqueMissing = unique(missingTotals);
  const uniqueUnhydrated = unique(unhydrated);
  const total =
    uniqueOverrun.length +
    uniqueMissing.length +
    uniqueUnhydrated.length +
    duplicates.length;

  return {
    overrun: uniqueOverrun,
    missingTotals: uniqueMissing,
    unhydrated: uniqueUnhydrated,
    duplicates,
    clean: total === 0,
    total,
  };
}
