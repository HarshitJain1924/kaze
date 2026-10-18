import type {
  AnimeDate,
  AnimeFormat,
  AnimeReleaseStatus,
  AnimeTitles,
} from "@/types/anime";

export function cn(
  ...values: Array<string | null | undefined | false>
): string {
  return values.filter(Boolean).join(" ");
}

const TITLE_FALLBACK = "Untitled anime";

export function getDisplayTitle(
  titles: AnimeTitles,
  preferEnglish = true,
): string {
  const primary = preferEnglish
    ? titles.english ?? titles.romaji ?? titles.native
    : titles.romaji ?? titles.english ?? titles.native;
  return primary?.trim() || TITLE_FALLBACK;
}

export function getSecondaryTitle(
  titles: AnimeTitles,
  primary: string,
): string | null {
  const candidates = [titles.romaji, titles.english, titles.native];
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (value && value.toLowerCase() !== primary.toLowerCase()) {
      return value;
    }
  }
  return null;
}

export function formatScore(score: number | null): string | null {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return null;
  }
  return (score / 10).toFixed(1);
}

export const FORMAT_LABELS: Record<AnimeFormat, string> = {
  TV: "TV",
  TV_SHORT: "TV Short",
  MOVIE: "Movie",
  OVA: "OVA",
  ONA: "ONA",
  SPECIAL: "Special",
  MUSIC: "Music",
};

export function formatFormat(format: AnimeFormat | null): string | null {
  return format ? FORMAT_LABELS[format] : null;
}

export const RELEASE_STATUS_LABELS: Record<AnimeReleaseStatus, string> = {
  FINISHED: "Finished",
  RELEASING: "Airing",
  NOT_YET_RELEASED: "Upcoming",
  CANCELLED: "Cancelled",
  HIATUS: "On hiatus",
};

export function formatReleaseStatus(
  status: AnimeReleaseStatus | null,
): string | null {
  return status ? RELEASE_STATUS_LABELS[status] : null;
}

export function formatEpisodeCount(
  episodes: number | null,
  options: { short?: boolean } = {},
): string {
  if (episodes === null) {
    return options.short ? "? eps" : "Episode count unknown";
  }
  if (episodes === 1) {
    return options.short ? "1 ep" : "1 episode";
  }
  return options.short ? `${episodes} eps` : `${episodes} episodes`;
}

export function formatPopularity(popularity: number | null): string | null {
  if (popularity === null) {
    return null;
  }
  if (popularity >= 1_000_000) {
    return `${(popularity / 1_000_000).toFixed(1)}M`;
  }
  if (popularity >= 1_000) {
    return `${Math.round(popularity / 1_000)}K`;
  }
  return String(popularity);
}

export function formatAnimeDate(date: AnimeDate | null): string | null {
  if (!date?.year) {
    return null;
  }
  if (!date.month) {
    return String(date.year);
  }
  const value = new Date(Date.UTC(date.year, date.month - 1, date.day ?? 1));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: date.day ? "numeric" : undefined,
    year: "numeric",
    timeZone: "UTC",
  }).format(value);
}

export function formatIsoDate(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function formatShortIsoDate(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsed);
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#039;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
};

export function stripHtml(input: string | null): string | null {
  if (!input) {
    return null;
  }

  const withoutTags = input
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const value = Number.parseInt(code, 10);
      return Number.isFinite(value) && value > 0 && value <= 0x10ffff
        ? String.fromCodePoint(value)
        : "";
    });

  const decoded = withoutTags.replace(
    /&[a-z]+;|&#\d+;/gi,
    (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity,
  );

  return decoded
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim() || null;
}

export function getInitials(email: string | null | undefined): string {
  if (!email) {
    return "?";
  }
  const [local] = email.split("@");
  if (!local) {
    return "?";
  }
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return count === 1 ? singular : plural;
}

export function todayIsoDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

const RELATION_TYPE_LABELS: Record<string, string> = {
  SEQUEL: "Sequel",
  PREQUEL: "Prequel",
  SIDE_STORY: "Side story",
  SPIN_OFF: "Spin-off",
  ALTERNATIVE: "Alternative",
  PARENT: "Parent story",
  SUMMARY: "Summary",
  CHARACTER: "Character",
  OTHER: "Related",
  ADAPTATION: "Adaptation",
};

export function formatRelationType(type: string | null): string | null {
  if (!type) {
    return null;
  }
  const known = RELATION_TYPE_LABELS[type];
  if (known) {
    return known;
  }
  const words = type.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
