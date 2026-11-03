import type { AnimeTheme } from "@/types/theme";

const USER_AGENT = "KazeAnimeTracker/1.0 (https://github.com/kaze-app)";
const THEMES_CACHE = new Map<number, { timestamp: number; themes: AnimeTheme[] }>();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

export async function fetchAnimeThemes(
  anilistId: number,
  fallbackTitle?: string,
): Promise<AnimeTheme[]> {
  const cached = THEMES_CACHE.get(anilistId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.themes;
  }

  try {
    let slug: string | null = null;

    // 1. Try resolving via AnimeThemes AniList resource mapping
    const resourceUrl = `https://api.animethemes.moe/resource?filter[site]=AniList&filter[external_id]=${anilistId}&include=anime`;
    const resourceRes = await fetch(resourceUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5000),
    });

    if (resourceRes.ok) {
      const resourceData = await resourceRes.json();
      slug =
        resourceData?.resources?.[0]?.anime?.[0]?.slug ??
        resourceData?.resource?.anime?.[0]?.slug ??
        null;
    }

    // 2. If not found by resource ID, try searching by fallback name
    if (!slug && fallbackTitle) {
      const searchUrl = `https://api.animethemes.moe/anime?filter[name]=${encodeURIComponent(fallbackTitle)}&page[size]=1`;
      const searchRes = await fetch(searchUrl, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(4000),
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        slug = searchData?.anime?.[0]?.slug ?? null;
      }
    }

    if (!slug) {
      THEMES_CACHE.set(anilistId, { timestamp: Date.now(), themes: [] });
      return [];
    }

    // 3. Fetch full anime themes document with entries, videos, and songs
    const animeUrl = `https://api.animethemes.moe/anime/${encodeURIComponent(slug)}?include=animethemes.animethemeentries.videos,animethemes.song.artists`;
    const animeRes = await fetch(animeUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(6000),
    });

    if (!animeRes.ok) {
      THEMES_CACHE.set(anilistId, { timestamp: Date.now(), themes: [] });
      return [];
    }

    const animeData = await animeRes.json();
    const rawThemes = animeData?.anime?.animethemes ?? [];

    const themes: AnimeTheme[] = [];
    for (const t of rawThemes) {
      if (t.type !== "OP" && t.type !== "ED") continue;

      const title = t.song?.title?.trim() || `Theme ${t.slug || ""}`;
      const artists = (t.song?.artists ?? [])
        .map((a: { name?: string }) => a.name?.trim())
        .filter(Boolean)
        .join(", ");

      const entry = t.animethemeentries?.[0];
      const video = entry?.videos?.[0];

      themes.push({
        id: `theme_${t.id}_${t.slug || ""}`,
        slug: t.slug ?? (t.type === "OP" ? "OP" : "ED"),
        type: t.type as "OP" | "ED",
        title,
        artist: artists || "Unknown Artist",
        episodes: entry?.episodes ? `Ep ${entry.episodes}` : null,
        videoUrl: video?.link ?? null,
        audioUrl: video?.audio?.link ?? null,
      });
    }

    THEMES_CACHE.set(anilistId, { timestamp: Date.now(), themes });
    return themes;
  } catch (error) {
    console.warn(
      `[AnimeThemes] could not load themes for anime ${anilistId}:`,
      error instanceof Error ? error.message : "unknown error",
    );
    return [];
  }
}

