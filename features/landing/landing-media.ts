import { isHttpUrl } from "@/lib/utils";
import type { AnimeSummary } from "@/types/anime";

export type LandingCoverSize = "extraLarge" | "large";

export function displayLandingTitle(item: AnimeSummary): string {
  return (
    item.title.english ??
    item.title.romaji ??
    item.title.native ??
    "Untitled"
  );
}

/**
 * Prefer AniList's extraLarge artwork for editorial leads and fall back to the
 * large source only when the primary image is missing or unsafe. No unrelated
 * poster is substituted for a title that has no artwork.
 */
export function selectLandingCover(
  item: AnimeSummary,
  preferred: LandingCoverSize = "extraLarge",
): string | null {
  const primary = item.coverImage[preferred];
  if (isHttpUrl(primary)) return primary;

  const alternate =
    preferred === "extraLarge"
      ? item.coverImage.large
      : item.coverImage.extraLarge;
  return isHttpUrl(alternate) ? alternate : null;
}

/**
 * AniList models manga, manhwa and manhua under `type: MANGA`. The country of
 * origin is the reliable discriminator used throughout Kaze: JP is manga and
 * KR is manhwa. Keep other origins out of these two landing collections.
 */
export function splitMangaByOrigin<T extends AnimeSummary>(
  items: T[],
): { manga: T[]; manhwa: T[] } {
  const seen = new Set<number>();
  const manga: T[] = [];
  const manhwa: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) continue;
    if (item.mediaType !== "manga" || item.isAdult) continue;
    seen.add(item.id);

    if (item.countryOfOrigin === "JP") {
      manga.push(item);
    } else if (item.countryOfOrigin === "KR") {
      manhwa.push(item);
    }
  }

  return { manga, manhwa };
}
