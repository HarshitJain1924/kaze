import type { TmdbKind, TmdbUniverse, TmdbUniverseEntry } from "@/types/tmdb";

/**
 * A shared universe that TMDB models as a community-maintained keyword rather
 * than a collection. Collections only cover one sub-franchise ("The Avengers
 * Collection"), so a keyword keeps every title in the universe in release
 * order, which is the order people actually watch a universe through.
 *
 * Company tags were tried first and are too broad: "Marvel Studios" also
 * matches licensed films such as Spider-Man 3 and Fantastic Four.
 */
export interface TmdbUniverseDefinition {
  id: string;
  label: string;
  shortLabel: string;
  kind: TmdbKind;
  /** TMDB keyword that tags every title inside the universe. */
  keywordId: number;
  /** TMDB discover sort field holding the release date for this kind. */
  sortField: "primary_release_date" | "first_air_date";
  /** Making-of documentaries that share the universe tag but are not entries. */
  excludedTitlePrefixes?: readonly string[];
}

export const TMDB_UNIVERSES: readonly TmdbUniverseDefinition[] = [
  {
    id: "mcu",
    label: "Marvel Cinematic Universe",
    shortLabel: "MCU",
    kind: "movie",
    keywordId: 180547,
    sortField: "primary_release_date",
    excludedTitlePrefixes: ["Marvel Studios", "A Fan's Guide"],
  },
  {
    id: "dceu",
    label: "DC Extended Universe",
    shortLabel: "DCEU",
    kind: "movie",
    keywordId: 229266,
    sortField: "primary_release_date",
  },
  {
    id: "monsterverse",
    label: "MonsterVerse",
    shortLabel: "MonsterVerse",
    kind: "movie",
    keywordId: 380322,
    sortField: "primary_release_date",
  },
];

export function matchTmdbUniverse(
  kind: TmdbKind,
  keywordIds: readonly number[],
): TmdbUniverseDefinition | null {
  if (keywordIds.length === 0) return null;

  const tagged = new Set(keywordIds);
  for (const universe of TMDB_UNIVERSES) {
    if (universe.kind !== kind) continue;
    if (tagged.has(universe.keywordId)) return universe;
  }

  return null;
}

/**
 * Watch orders only list titles someone can actually watch: no making-of
 * documentaries, no announcements still waiting on a release date.
 */
export function isListableUniverseEntry(
  entry: TmdbUniverseEntry,
  definition: TmdbUniverseDefinition,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  if (!entry.releaseDate || entry.releaseDate > today) return false;

  const excluded = definition.excludedTitlePrefixes ?? [];
  return !excluded.some((prefix) =>
    entry.title.toLowerCase().startsWith(prefix.toLowerCase()),
  );
}

export function universeUnitLabel(kind: TmdbKind, total: number): string {
  if (kind === "tv") return "series";
  // Universe keywords also cover one-shots and specials, so "titles" is the
  // honest count; "films" would overstate a roster padded with shorts.
  return total === 1 ? "title" : "titles";
}

/** "#6 of 34" for a title that is listed in the universe. */
export function universePositionLabel(
  position: number,
  total: number,
): string {
  return `#${position} of ${total}`;
}

/**
 * Pairs a release-ordered roster with the title being viewed so the UI can say
 * where that title sits in the run.
 */
export function buildTmdbUniverse(
  definition: TmdbUniverseDefinition,
  roster: { total: number; entries: TmdbUniverseEntry[] },
  tmdbId: number,
): TmdbUniverse {
  const index = roster.entries.findIndex((entry) => entry.tmdbId === tmdbId);
  return {
    id: definition.id,
    label: definition.label,
    shortLabel: definition.shortLabel,
    total: roster.total,
    position: index >= 0 ? index + 1 : null,
    entries: roster.entries,
  };
}
