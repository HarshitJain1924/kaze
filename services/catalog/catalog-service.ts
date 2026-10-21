import { getAniListClient, AniListClient } from "@/services/anilist/client";
import {
  AniListError,
  AniListSuspendedError,
  CircuitBreakerOpenError,
} from "@/services/anilist/errors";
import {
  getMetadataCache,
  MetadataCache,
} from "@/services/catalog/metadata-cache";
import {
  getKitsuClient,
  KitsuClient,
} from "@/services/catalog/kitsu-client";
import type {
  AiringScheduleEntry,
  Anime,
  AnimePage,
  AnimeSearchParams,
  AnimeSeason,
  AnimeSummary,
} from "@/types/anime";

export interface CatalogProviderStatus {
  isSuspended: boolean;
  circuitBreakerState: "CLOSED" | "OPEN" | "HALF_OPEN";
  activeProvider: "anilist" | "kitsu" | "cache";
  cachedTitlesCount: number;
}

export interface CatalogServiceOptions {
  anilistClient?: AniListClient;
  metadataCache?: MetadataCache;
  kitsuClient?: KitsuClient;
}

/**
 * Shared catalogue provider abstraction that protects Kaze from upstream
 * provider outages (such as AniList suspensions or HTTP 403/429 limits).
 * Coordinates primary AniList, secondary Kitsu provider, and persistent local metadata cache.
 */
export class CatalogService {
  readonly anilistClient: AniListClient;
  readonly metadataCache: MetadataCache;
  readonly kitsuClient: KitsuClient;

  constructor(options: CatalogServiceOptions = {}) {
    this.anilistClient = options.anilistClient ?? getAniListClient();
    this.metadataCache = options.metadataCache ?? getMetadataCache();
    this.kitsuClient = options.kitsuClient ?? getKitsuClient();
  }

  getStatus(): CatalogProviderStatus {
    const cb = this.anilistClient.circuitBreaker.getState();
    const isSuspended = cb.state === "OPEN";
    return {
      isSuspended,
      circuitBreakerState: cb.state,
      activeProvider: isSuspended ? "kitsu" : "anilist",
      cachedTitlesCount: this.metadataCache.size,
    };
  }

  resetCircuitBreaker(): void {
    this.anilistClient.circuitBreaker.reset();
  }

  /**
   * Resolves a single anime by ID.
   * Checks primary AniList -> persistent cache fallback -> secondary Kitsu cross-mapping.
   */
  async getAnimeById(id: number): Promise<Anime | null> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AniListError("Invalid anime id");
    }

    // 1. If AniList circuit breaker is open, bypass network and serve cache or secondary provider immediately
    if (this.anilistClient.circuitBreaker.isOpen()) {
      const cached = this.metadataCache.getDetails(id);
      if (cached) return cached.data;

      const summary = this.metadataCache.getSummary(id);
      if (summary) {
        return this.summaryToDetailedAnime(summary.data);
      }

      const kitsuSummary = await this.kitsuClient.getAnimeByAnilistId(id);
      if (kitsuSummary) {
        this.metadataCache.putSummary(kitsuSummary);
        return this.summaryToDetailedAnime(kitsuSummary);
      }

      return null;
    }

    // 2. Try primary AniList
    try {
      const anime = await this.anilistClient.getAnimeById(id);
      if (anime) {
        this.metadataCache.putDetails(anime);
        this.metadataCache.putSummary(anime);
      }
      return anime;
    } catch (error) {
      // If error is genuine 404 "not found", do not treat as an outage
      if (
        error instanceof AniListError &&
        (error.status === 404 ||
          (error.status === 400 && /not found/i.test(error.message)))
      ) {
        return null;
      }

      // Check if outage (suspension, circuit breaker, 5xx, or network timeout)
      if (this.isOutageError(error)) {
        // Fallback: cached details or summary
        const cached = this.metadataCache.getDetails(id);
        if (cached) return cached.data;

        const summary = this.metadataCache.getSummary(id);
        if (summary) {
          return this.summaryToDetailedAnime(summary.data);
        }

        // Secondary provider fallback via AniList cross-mapping
        const kitsuSummary = await this.kitsuClient.getAnimeByAnilistId(id);
        if (kitsuSummary) {
          this.metadataCache.putSummary(kitsuSummary);
          return this.summaryToDetailedAnime(kitsuSummary);
        }
      }

      throw error;
    }
  }

  /**
   * Batch resolves anime summaries for library items.
   * Recovers cached metadata during outages and maps missing entries via secondary Kitsu.
   */
  async getAnimeByIds(ids: number[]): Promise<Map<number, AnimeSummary>> {
    const unique = [
      ...new Set(ids.filter((id) => Number.isInteger(id) && id > 0)),
    ];
    if (unique.length === 0) {
      return new Map();
    }

    const resultMap = new Map<number, AnimeSummary>();

    // 1. Check persistent cache for any already known IDs
    const { found, missing } = this.metadataCache.getSummaries(unique);
    for (const [id, item] of found) {
      resultMap.set(id, item);
    }

    // 2. If all are in cache and circuit breaker is open, return immediately without network overhead
    if (missing.length === 0 && this.anilistClient.circuitBreaker.isOpen()) {
      return resultMap;
    }

    // 3. Query primary AniList for missing (or all if circuit breaker is closed)
    const toQuery = missing.length > 0 ? missing : unique;
    if (!this.anilistClient.circuitBreaker.isOpen()) {
      try {
        const liveMap = await this.anilistClient.getAnimeByIds(toQuery);
        for (const [id, item] of liveMap) {
          resultMap.set(id, item);
        }
        this.metadataCache.putSummaries(Array.from(liveMap.values()));
      } catch (error) {
        if (!this.isOutageError(error)) {
          throw error;
        }
        // AniList failed or is suspended; proceed to secondary provider
      }
    }

    // 4. For any IDs still missing, resolve through secondary provider (Kitsu) via AniList mapping
    const stillMissing = unique.filter((id) => !resultMap.has(id));
    if (stillMissing.length > 0) {
      await Promise.allSettled(
        stillMissing.map(async (id) => {
          const kitsuSummary = await this.kitsuClient.getAnimeByAnilistId(id);
          if (kitsuSummary) {
            resultMap.set(id, kitsuSummary);
            this.metadataCache.putSummary(kitsuSummary);
          }
        }),
      );
    }

    return resultMap;
  }

  /**
   * Searches for anime.
   * If AniList is suspended or circuit breaker is open, gracefully uses Kitsu search
   * with cross-provider AniList ID resolution, or local metadata search.
   */
  async searchAnime(params: AnimeSearchParams = {}): Promise<AnimePage> {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const perPage = Math.max(1, Math.min(50, Math.trunc(params.perPage ?? 24)));
    const search = params.query?.trim();

    // 1. If circuit breaker is open, bypass failing network and use secondary provider or local cache
    if (this.anilistClient.circuitBreaker.isOpen()) {
      return this.fallbackSearch(search, page, perPage);
    }

    try {
      const pageResult = await this.anilistClient.searchAnime(params);
      this.metadataCache.putSummaries(pageResult.items);
      return pageResult;
    } catch (error) {
      if (this.isOutageError(error)) {
        return this.fallbackSearch(search, page, perPage);
      }
      throw error;
    }
  }

  private async fallbackSearch(
    search: string | undefined,
    page: number,
    perPage: number,
  ): Promise<AnimePage> {
    if (search) {
      // 1. Try secondary Kitsu provider
      try {
        const kitsuItems = await this.kitsuClient.searchAnime(search, perPage);
        if (kitsuItems.length > 0) {
          this.metadataCache.putSummaries(kitsuItems);
          return {
            pageInfo: {
              currentPage: page,
              lastPage: 1,
              hasNextPage: false,
              total: kitsuItems.length,
            },
            items: kitsuItems,
          };
        }
      } catch {
        // Kitsu error; continue to local cache
      }

      // 2. Try local metadata cache
      const localMatches = this.metadataCache.searchLocal(search, perPage);
      if (localMatches.length > 0) {
        return {
          pageInfo: {
            currentPage: page,
            lastPage: 1,
            hasNextPage: false,
            total: localMatches.length,
          },
          items: localMatches,
        };
      }
    } else {
      // Empty query (e.g. browsing discover or popular feed)
      const popular = this.metadataCache.getPopular();
      if (popular && popular.length > 0) {
        return {
          pageInfo: {
            currentPage: 1,
            lastPage: 1,
            hasNextPage: false,
            total: popular.length,
          },
          items: popular.slice(0, perPage),
        };
      }
    }

    // If query was not found or both providers failed, throw clean suspended error
    // so caller knows this is an outage rather than misrepresenting as a genuine 0-results search.
    throw new AniListSuspendedError();
  }

  async getAiringSchedule(params: {
    airingAtGreater: number;
    airingAtLesser: number;
    mediaIds?: number[];
    perPage?: number;
  }): Promise<AiringScheduleEntry[]> {
    if (this.anilistClient.circuitBreaker.isOpen()) {
      throw new AniListSuspendedError();
    }
    return this.anilistClient.getAiringSchedule(params);
  }

  async getSeasonalAnime(
    season: AnimeSeason,
    seasonYear: number,
    options: { page?: number; perPage?: number } = {},
  ): Promise<AnimePage> {
    const perPage = options.perPage ?? 12;
    if (this.anilistClient.circuitBreaker.isOpen()) {
      const cached =
        this.metadataCache.getSeasonal(season, seasonYear) ??
        this.metadataCache.getPopular();
      if (cached && cached.length > 0) {
        return {
          pageInfo: {
            currentPage: 1,
            lastPage: 1,
            hasNextPage: false,
            total: cached.length,
          },
          items: cached.slice(0, perPage),
        };
      }
      throw new AniListSuspendedError();
    }

    try {
      const pageResult = await this.anilistClient.getSeasonalAnime(
        season,
        seasonYear,
        options,
      );
      this.metadataCache.putSeasonal(season, seasonYear, pageResult.items);
      this.metadataCache.putSummaries(pageResult.items);
      return pageResult;
    } catch (error) {
      if (this.isOutageError(error)) {
        const cached =
          this.metadataCache.getSeasonal(season, seasonYear) ??
          this.metadataCache.getPopular();
        if (cached && cached.length > 0) {
          return {
            pageInfo: {
              currentPage: 1,
              lastPage: 1,
              hasNextPage: false,
              total: cached.length,
            },
            items: cached.slice(0, perPage),
          };
        }
      }
      throw error;
    }
  }

  async getPopularAnime(
    options: { page?: number; perPage?: number } = {},
  ): Promise<AnimePage> {
    const perPage = options.perPage ?? 12;
    if (this.anilistClient.circuitBreaker.isOpen()) {
      const cached = this.metadataCache.getPopular();
      if (cached && cached.length > 0) {
        return {
          pageInfo: {
            currentPage: 1,
            lastPage: 1,
            hasNextPage: false,
            total: cached.length,
          },
          items: cached.slice(0, perPage),
        };
      }
      throw new AniListSuspendedError();
    }

    try {
      const pageResult = await this.anilistClient.getPopularAnime(options);
      this.metadataCache.putPopular(pageResult.items);
      this.metadataCache.putSummaries(pageResult.items);
      return pageResult;
    } catch (error) {
      if (this.isOutageError(error)) {
        const cached = this.metadataCache.getPopular();
        if (cached && cached.length > 0) {
          return {
            pageInfo: {
              currentPage: 1,
              lastPage: 1,
              hasNextPage: false,
              total: cached.length,
            },
            items: cached.slice(0, perPage),
          };
        }
      }
      throw error;
    }
  }

  async getTrendingAnime(
    options: { page?: number; perPage?: number } = {},
  ): Promise<AnimePage> {
    const perPage = options.perPage ?? 12;
    if (this.anilistClient.circuitBreaker.isOpen()) {
      const cached =
        this.metadataCache.getTrending() ?? this.metadataCache.getPopular();
      if (cached && cached.length > 0) {
        return {
          pageInfo: {
            currentPage: 1,
            lastPage: 1,
            hasNextPage: false,
            total: cached.length,
          },
          items: cached.slice(0, perPage),
        };
      }
      throw new AniListSuspendedError();
    }

    try {
      const pageResult = await this.anilistClient.getTrendingAnime(options);
      this.metadataCache.putTrending(pageResult.items);
      this.metadataCache.putSummaries(pageResult.items);
      return pageResult;
    } catch (error) {
      if (this.isOutageError(error)) {
        const cached =
          this.metadataCache.getTrending() ?? this.metadataCache.getPopular();
        if (cached && cached.length > 0) {
          return {
            pageInfo: {
              currentPage: 1,
              lastPage: 1,
              hasNextPage: false,
              total: cached.length,
            },
            items: cached.slice(0, perPage),
          };
        }
      }
      throw error;
    }
  }

  private isOutageError(error: unknown): boolean {
    if (error instanceof AniListSuspendedError) return true;
    if (error instanceof CircuitBreakerOpenError) return true;
    if (error instanceof AniListError) {
      return (
        error.isSuspended ||
        error.status === 403 ||
        error.status === null ||
        (error.status !== null && error.status >= 500)
      );
    }
    return false;
  }

  private summaryToDetailedAnime(summary: AnimeSummary): Anime {
    return {
      ...summary,
      synopsis: null,
      bannerImage: null,
      startDate: { year: summary.seasonYear, month: null, day: null },
      endDate: { year: null, month: null, day: null },
      genres: summary.genres,
      tags: [],
      season: null,
      duration: null,
      popularity: null,
      relations: [],
    };
  }
}

let defaultCatalogService: CatalogService | null = null;

export function getCatalogService(): CatalogService {
  defaultCatalogService ??= new CatalogService();
  return defaultCatalogService;
}
