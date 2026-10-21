import { MetadataCache } from "@/services/catalog/metadata-cache";
import type { Anime, AnimeSummary } from "@/types/anime";

export function makeSummary(
  id: number,
  overrides: Partial<AnimeSummary> = {},
): AnimeSummary {
  return {
    id,
    title: {
      english: `Anime ${id}`,
      romaji: `Anime ${id}`,
      native: null,
    },
    coverImage: {
      extraLarge: `https://example.com/cover-${id}.jpg`,
      large: null,
      color: null,
    },
    format: "TV",
    episodes: 12,
    averageScore: 80,
    seasonYear: 2024,
    status: "FINISHED",
    genres: ["Action"],
    ...overrides,
  };
}

export function makeAnime(
  id: number,
  overrides: Partial<Anime> = {},
): Anime {
  return {
    ...makeSummary(id),
    bannerImage: null,
    synopsis: "A synopsis.",
    tags: [],
    season: "FALL",
    duration: 24,
    popularity: 1000,
    startDate: { year: 2024, month: 10, day: 1 },
    endDate: null,
    relations: [],
    ...overrides,
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

/** A media node shaped like the AniList details query response. */
export function anilistMedia(
  id: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    type: "ANIME",
    title: {
      romaji: `Anime ${id}`,
      english: `Anime ${id}`,
      native: null,
    },
    coverImage: {
      extraLarge: `https://s4.anilist.co/file/cover-${id}.jpg`,
      large: null,
      color: null,
    },
    bannerImage: null,
    description: "A synopsis.",
    format: "TV",
    episodes: 12,
    averageScore: 80,
    seasonYear: 2024,
    season: "FALL",
    duration: 24,
    popularity: 1000,
    status: "FINISHED",
    genres: ["Action"],
    tags: [],
    startDate: { year: 2024, month: 10, day: 1 },
    endDate: null,
    relations: { edges: [] },
    ...overrides,
  };
}

export function anilistDetailsResponse(
  id: number,
  overrides: Record<string, unknown> = {},
): Response {
  return jsonResponse({ data: { Media: anilistMedia(id, overrides) } });
}

export function anilistPageResponse(
  ids: number[],
  pageInfo: Record<string, unknown> = {},
): Response {
  return jsonResponse({
    data: {
      Page: {
        pageInfo: {
          currentPage: 1,
          lastPage: 1,
          hasNextPage: false,
          total: ids.length,
          ...pageInfo,
        },
        media: ids.map((id) => anilistMedia(id)),
      },
    },
  });
}

export function suspensionResponse(): Response {
  return jsonResponse(
    {
      errors: [
        {
          message:
            "The AniList API has been temporarily disabled due to severe stability issues.",
          status: 403,
        },
      ],
      data: null,
    },
    403,
  );
}

export interface KitsuAnimeFixtureOptions {
  kitsuId?: string;
  attributes?: Record<string, unknown>;
  id?: string;
}

export function kitsuAnimeResource(
  anilistId: number,
  options: KitsuAnimeFixtureOptions = {},
): Record<string, unknown> {
  const kitsuId = options.kitsuId ?? String(46_000 + anilistId);
  return {
    id: options.id ?? kitsuId,
    type: "anime",
    attributes: {
      canonicalTitle: `Kitsu ${anilistId}`,
      titles: {
        en: `Kitsu English ${anilistId}`,
        en_jp: `Kitsu Romaji ${anilistId}`,
        ja_jp: "キツ",
      },
      posterImage: {
        original: `https://media.kitsu.app/${kitsuId}/original.jpg`,
        large: `https://media.kitsu.app/${kitsuId}/large.jpg`,
        medium: `https://media.kitsu.app/${kitsuId}/medium.jpg`,
        small: `https://media.kitsu.app/${kitsuId}/small.jpg`,
      },
      subtype: "TV",
      status: "finished",
      episodeCount: 24,
      averageRating: "82.4",
      startDate: "2024-10-01",
      ...options.attributes,
    },
  };
}

export function kitsuMappingResource(
  anilistId: number,
  kitsuId: string,
  options: { mappingId?: string; externalId?: string } = {},
): Record<string, unknown> {
  return {
    id: options.mappingId ?? `mapping-${anilistId}`,
    type: "mappings",
    attributes: {
      externalSite: "anilist/anime",
      externalId: options.externalId ?? String(anilistId),
    },
    relationships: {
      item: { data: { type: "anime", id: kitsuId } },
    },
  };
}

export function kitsuMappingResponse(
  anilistId: number,
  options: KitsuAnimeFixtureOptions = {},
): Response {
  const kitsuId = options.kitsuId ?? String(46_000 + anilistId);
  return jsonResponse({
    data: [kitsuMappingResource(anilistId, kitsuId)],
    included: [kitsuAnimeResource(anilistId, { ...options, kitsuId })],
  });
}

/** Response for a search hit with an included AniList mapping. */
export function kitsuSearchResponse(
  entries: Array<{
    anilistId: number;
    kitsuId?: string;
    attributes?: Record<string, unknown>;
    mappingIds?: string[];
  }>,
  meta: { count?: number } = {},
): Response {
  const data: Array<Record<string, unknown>> = [];
  const included: Array<Record<string, unknown>> = [];

  entries.forEach((entry, index) => {
    const kitsuId = entry.kitsuId ?? String(50_000 + index);
    data.push({
      ...kitsuAnimeResource(entry.anilistId, {
        kitsuId,
        attributes: entry.attributes,
      }),
      id: kitsuId,
      relationships: {
        mappings: {
          data: (entry.mappingIds ?? [`m-${index}`]).map((id) => ({
            type: "mappings",
            id,
          })),
        },
      },
    });
    for (const mappingId of entry.mappingIds ?? [`m-${index}`]) {
      included.push(kitsuMappingResource(entry.anilistId, kitsuId, { mappingId }));
    }
  });

  return jsonResponse({
    data,
    included,
    meta: { count: meta.count ?? entries.length },
  });
}

export function createTestCache(
  options: Partial<ConstructorParameters<typeof MetadataCache>[0]> = {},
): MetadataCache {
  return new MetadataCache({
    persistence: null,
    logger: { warn: () => {} },
    ...options,
  });
}
