import type { AnimeFormat, AnimeReleaseStatus, AnimeSummary } from "@/types/anime";

const KITSU_BASE = "https://kitsu.io/api/edge";

interface KitsuAnimeAttributes {
  canonicalTitle?: string;
  titles?: {
    en?: string;
    en_jp?: string;
    ja_jp?: string;
  };
  posterImage?: {
    original?: string;
    large?: string;
    medium?: string;
    small?: string;
  };
  subtype?: string;
  status?: string;
  episodeCount?: number | null;
  averageRating?: string | null;
  startDate?: string | null;
}

interface KitsuMappingAttributes {
  externalSite?: string;
  externalId?: string;
}

interface KitsuResource {
  id: string;
  type: string;
  attributes?: KitsuAnimeAttributes | KitsuMappingAttributes;
  relationships?: {
    mappings?: { data?: Array<{ id: string; type: string }> };
  };
}

interface KitsuResponse {
  data?: KitsuResource | KitsuResource[];
  included?: KitsuResource[];
}

function mapKitsuFormat(subtype?: string): AnimeFormat | null {
  if (!subtype) return null;
  switch (subtype.toUpperCase()) {
    case "TV":
      return "TV";
    case "MOVIE":
      return "MOVIE";
    case "OVA":
      return "OVA";
    case "ONA":
      return "ONA";
    case "SPECIAL":
      return "SPECIAL";
    case "MUSIC":
      return "MUSIC";
    default:
      return "TV";
  }
}

function mapKitsuStatus(status?: string): AnimeReleaseStatus | null {
  if (!status) return null;
  switch (status.toLowerCase()) {
    case "current":
      return "RELEASING";
    case "finished":
      return "FINISHED";
    case "unreleased":
    case "upcoming":
      return "NOT_YET_RELEASED";
    default:
      return null;
  }
}

export class KitsuClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: { baseUrl?: string; fetchImpl?: typeof fetch } = {}) {
    this.baseUrl = options.baseUrl ?? KITSU_BASE;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async fetchJson(path: string): Promise<KitsuResponse> {
    const url = `${this.baseUrl}${path}`;
    const res = await this.fetchImpl(url, {
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      throw new Error(`Kitsu request failed with status ${res.status}`);
    }

    return (await res.json()) as KitsuResponse;
  }

  /**
   * Resolves an anime by its canonical AniList ID via Kitsu's external mapping table.
   */
  async getAnimeByAnilistId(anilistId: number): Promise<AnimeSummary | null> {
    try {
      const json = await this.fetchJson(
        `/mappings?filter[externalSite]=anilist/anime&filter[externalId]=${anilistId}&include=item`,
      );

      const animeResource = json.included?.find((item) => item.type === "anime");
      if (!animeResource || !animeResource.attributes) {
        return null;
      }

      const attrs = animeResource.attributes as KitsuAnimeAttributes;
      const year = attrs.startDate ? new Date(attrs.startDate).getFullYear() : null;

      return {
        id: anilistId, // Preserve AniList canonical ID
        title: {
          english: attrs.titles?.en ?? attrs.canonicalTitle ?? null,
          romaji: attrs.titles?.en_jp ?? attrs.canonicalTitle ?? null,
          native: attrs.titles?.ja_jp ?? null,
        },
        coverImage: {
          extraLarge: attrs.posterImage?.original ?? attrs.posterImage?.large ?? null,
          large: attrs.posterImage?.medium ?? attrs.posterImage?.large ?? null,
          color: null,
        },
        format: mapKitsuFormat(attrs.subtype),
        episodes: attrs.episodeCount ?? null,
        averageScore: attrs.averageRating ? Math.round(Number(attrs.averageRating)) : null,
        seasonYear: Number.isFinite(year) ? year : null,
        status: mapKitsuStatus(attrs.status),
        genres: [],
      };
    } catch {
      return null;
    }
  }

  /**
   * Searches Kitsu for anime and preserves cross-provider AniList IDs where mapped.
   */
  async searchAnime(query: string, limit = 20): Promise<AnimeSummary[]> {
    const clean = query.trim();
    if (!clean) return [];

    try {
      const json = await this.fetchJson(
        `/anime?filter[text]=${encodeURIComponent(clean)}&page[limit]=${limit}&include=mappings`,
      );

      const items = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];
      const included = json.included ?? [];
      const results: AnimeSummary[] = [];

      for (const item of items) {
        const attrs = item.attributes as KitsuAnimeAttributes;
        if (!attrs) continue;

        // Try to find mapped AniList ID
        let resolvedId: number | null = null;
        const mappingRefs = item.relationships?.mappings?.data ?? [];
        for (const ref of mappingRefs) {
          const mapping = included.find(
            (inc) => inc.id === ref.id && inc.type === "mappings",
          );
          const mapAttrs = mapping?.attributes as KitsuMappingAttributes | undefined;
          if (
            mapAttrs?.externalSite === "anilist/anime" &&
            mapAttrs.externalId &&
            Number(mapAttrs.externalId) > 0
          ) {
            resolvedId = Number(mapAttrs.externalId);
            break;
          }
        }

        // If no AniList mapping exists, skip or map only if we can avoid collision
        if (!resolvedId) {
          continue;
        }

        const year = attrs.startDate ? new Date(attrs.startDate).getFullYear() : null;

        results.push({
          id: resolvedId,
          title: {
            english: attrs.titles?.en ?? attrs.canonicalTitle ?? null,
            romaji: attrs.titles?.en_jp ?? attrs.canonicalTitle ?? null,
            native: attrs.titles?.ja_jp ?? null,
          },
          coverImage: {
            extraLarge: attrs.posterImage?.original ?? attrs.posterImage?.large ?? null,
            large: attrs.posterImage?.medium ?? attrs.posterImage?.large ?? null,
            color: null,
          },
          format: mapKitsuFormat(attrs.subtype),
          episodes: attrs.episodeCount ?? null,
          averageScore: attrs.averageRating ? Math.round(Number(attrs.averageRating)) : null,
          seasonYear: Number.isFinite(year) ? year : null,
          status: mapKitsuStatus(attrs.status),
          genres: [],
        });
      }

      return results;
    } catch {
      return [];
    }
  }
}

let defaultKitsuClient: KitsuClient | null = null;

export function getKitsuClient(): KitsuClient {
  defaultKitsuClient ??= new KitsuClient();
  return defaultKitsuClient;
}
