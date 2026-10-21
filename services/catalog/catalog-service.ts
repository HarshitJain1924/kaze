import { TtlCache } from "@/lib/cache";
import {
  AniListClient,
  getAniListClient,
} from "@/services/anilist/client";
import {
  AniListError,
  AniListSuspendedError,
  CircuitBreakerOpenError,
} from "@/services/anilist/errors";
import type { CircuitState } from "@/services/anilist/circuit-breaker";
import {
  MetadataCache,
  getMetadataCache,
} from "@/services/catalog/metadata-cache";
import {
  getKitsuClient,
  KitsuClient,
  type KitsuLookupResult,
} from "@/services/catalog/kitsu-client";
import { CatalogUnavailableError } from "@/services/catalog/errors";
import type {
  AiringScheduleEntry,
  Anime,
  AnimePage,
  AnimeSearchParams,
  AnimeSeason,
  AnimeSummary,
} from "@/types/anime";

/** Provider that actually answered the most recent catalogue operation. */
export type CatalogProvider = "anilist" | "kitsu" | "cache" | "unavailable";

export interface CatalogProviderStatus {
  /**
   * True only when AniList itself confirmed a suspension (HTTP 403 or an
   * explicit "API disabled" message). An open circuit breaker caused by
   * transient 5xx/network failures is *not* a confirmed suspension.
   */
  isSuspended: boolean;
  suspensionConfirmedAt: number | null;
  circuitBreakerState: CircuitState;
  /**
   * Provider used by the most recent operation handled by this server
   * instance. It is diagnostic only and never inferred from breaker state.
   */
  activeProvider: CatalogProvider;
  lastProvider: CatalogProvider | null;
  /** True when the last operation was served by cache, Kitsu or nothing. */
  degraded: boolean;
  cachedTitlesCount: number;
}

export interface CatalogServiceOptions {
  anilistClient?: AniListClient;
  metadataCache?: MetadataCache;
  kitsuClient?: KitsuClient;
  now?: () => number;
}

/** Keep fallback pressure on Kitsu low and bounded. */
const KITSU_CONCURRENCY = 4;
const KITSU_MISS_TTL_MS = 10 * 60_000;
const KITSU_WARNING_INTERVAL_MS = 60_000;
const FALLBACK_SEARCH_TTL_MS = 60_000;
const FALLBACK_SEARCH_CACHE_ENTRIES = 50;

function toSummary(anime: Anime): AnimeSummary {
  return {
    id: anime.id,
    title: anime.title,
    coverImage: anime.coverImage,
    format: anime.format,
    episodes: anime.episodes,
    averageScore: anime.averageScore,
    seasonYear: anime.seasonYear,
    status: anime.status,
    genres: anime.genres,
  };
}

function cachedPage(
  items: AnimeSummary[],
  page: number,
  perPage: number,
): AnimePage {
  const lastPage = Math.max(1, Math.ceil(items.length / perPage));
  const start = (page - 1) * perPage;
  return {
    items: items.slice(start, start + perPage),
    pageInfo: {
      currentPage: page,
      lastPage,
      hasNextPage: page < lastPage,
      total: items.length,
    },
  };
}

/**
 * Shared catalogue abstraction that keeps Kaze usable when AniList is
 * degraded.
 *
 * Read policy, in order:
 * 1. AniList when the circuit permits a request (fresh data wins).
 * 2. Fresh cached metadata.
 * 3. Stale cached metadata, flagged as a fallback, during an outage.
 * 4. Kitsu, but only with a verified AniList ID mapping.
 * 5. A clear unavailable error — never a pretend-empty result set.
 *
 * Only public provider metadata is cached. User-owned library and
 * episode-tracking records never enter this cache.
 */
export class CatalogService {
  readonly anilistClient: AniListClient;
  readonly metadataCache: MetadataCache;
  readonly kitsuClient: KitsuClient;

  private readonly now: () => number;

  private lastProvider: CatalogProvider | null = null;
  private suspensionConfirmedAt: number | null = null;
  private rateLimitedAt: number | null = null;
  private lastRetryAfterMs: number | null = null;

  private readonly kitsuInFlight = new Map<
    number,
    Promise<KitsuLookupResult | null>
  >();
  /** IDs known to have no usable Kitsu mapping, to avoid repeat lookups. */
  private readonly kitsuMisses = new Map<number, number>();
  private lastKitsuWarningAt = 0;
  /** Short-lived cache for degraded search results to avoid fallback storms. */
  private readonly fallbackSearches = new TtlCache<AnimePage>(
    FALLBACK_SEARCH_CACHE_ENTRIES,
  );
  private readonly fallbackSearchesInFlight = new Map<string, Promise<AnimePage>>();

  constructor(options: CatalogServiceOptions = {}) {
    this.anilistClient = options.anilistClient ?? getAniListClient();
    this.metadataCache = options.metadataCache ?? getMetadataCache();
    this.kitsuClient = options.kitsuClient ?? getKitsuClient();
    this.now = options.now ?? Date.now.bind(Date);
  }

  getStatus(): CatalogProviderStatus {
    const breaker = this.anilistClient.circuitBreaker.getState();
    const last = this.lastProvider;
    return {
      isSuspended: this.suspensionConfirmedAt !== null,
      suspensionConfirmedAt: this.suspensionConfirmedAt,
      circuitBreakerState: breaker.state,
      activeProvider:
        last ??
        (breaker.state === "CLOSED" ? "anilist" : "unavailable"),
      lastProvider: last,
      degraded: last !== null && last !== "anilist",
      cachedTitlesCount: this.metadataCache.size,
    };
  }

  resetCircuitBreaker(): void {
    this.anilistClient.circuitBreaker.reset();
  }

  // -------------------------------------------------------------------
  // Single anime
  // -------------------------------------------------------------------

  async getAnimeById(id: number): Promise<Anime | null> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AniListError("Invalid anime id");
    }

    await this.metadataCache.ready();

    if (!this.isUpstreamBlocked()) {
      try {
        const anime = await this.anilistClient.getAnimeById(id);
        this.noteAniListSuccess();

        if (!anime) {
          // A genuine "this anime does not exist" answer from a healthy API.
          this.noteProvider("anilist");
          return null;
        }

        this.metadataCache.putDetails(anime);
        this.metadataCache.putSummary(toSummary(anime));
        this.noteProvider("anilist");
        return anime;
      } catch (error) {
        if (this.isMissingError(error)) {
          this.noteAniListSuccess();
          this.noteProvider("anilist");
          return null;
        }
        if (!this.isOutageError(error)) {
          throw error;
        }
        this.recordOutage(error);
      }
    }

    const freshDetails = this.metadataCache.getDetails(id);
    if (freshDetails) {
      this.noteProvider("cache");
      return freshDetails.data;
    }
    const freshSummary = this.metadataCache.getSummary(id);
    if (freshSummary) {
      this.noteProvider("cache");
      return this.summaryToDetailedAnime(freshSummary.data);
    }
    const staleDetails = this.metadataCache.getDetails(id, {
      allowStale: true,
    });
    if (staleDetails) {
      this.noteProvider("cache");
      return staleDetails.data;
    }
    const staleSummary = this.metadataCache.getSummary(id, {
      allowStale: true,
    });
    if (staleSummary) {
      this.noteProvider("cache");
      return this.summaryToDetailedAnime(staleSummary.data);
    }

    const kitsu = await this.lookupKitsu(id);
    if (kitsu?.kind === "found") {
      this.metadataCache.putSummary(kitsu.summary);
      this.noteProvider("kitsu");
      return this.summaryToDetailedAnime(kitsu.summary);
    }

    this.noteProvider("unavailable");
    throw this.unavailable("Anime details are temporarily unavailable");
  }

  // -------------------------------------------------------------------
  // Library hydration
  // -------------------------------------------------------------------

  /**
   * Resolves summaries for library entries. IDs that cannot be resolved are
   * simply absent from the returned map, so callers keep the user's entry,
   * progress, rating and notes with `anime: null`.
   */
  async getAnimeByIds(ids: number[]): Promise<Map<number, AnimeSummary>> {
    const unique = [
      ...new Set(ids.filter((id) => Number.isInteger(id) && id > 0)),
    ];
    if (unique.length === 0) {
      return new Map();
    }

    await this.metadataCache.ready();

    const result = new Map<number, AnimeSummary>();
    let usedAniList = false;
    let usedCache = false;
    let usedKitsu = false;

    const fresh = this.metadataCache.getSummaries(unique);
    for (const [id, hit] of fresh.hits) {
      result.set(id, hit.data);
      usedCache = true;
    }

    const needsRefresh = unique.filter((id) => !result.has(id));
    if (needsRefresh.length > 0 && !this.isUpstreamBlocked()) {
      try {
        const live = await this.anilistClient.getAnimeByIds(needsRefresh);
        for (const [id, summary] of live) {
          result.set(id, summary);
          usedAniList = true;
        }
        if (live.size > 0) {
          this.metadataCache.putSummaries([...live.values()]);
        }
        this.noteAniListSuccess();
      } catch (error) {
        if (!this.isOutageError(error)) {
          throw error;
        }
        this.recordOutage(error);
      }
    }

    // Stale metadata is the next fallback during an outage.
    const missingAfterLive = unique.filter((id) => !result.has(id));
    if (missingAfterLive.length > 0) {
      const stale = this.metadataCache.getSummaries(missingAfterLive, {
        allowStale: true,
      });
      for (const [id, hit] of stale.hits) {
        result.set(id, hit.data);
        usedCache = true;
      }
    }

    // Only then ask Kitsu, with verified AniList mappings and bounded fan-out.
    const stillMissing = unique.filter((id) => !result.has(id));
    if (stillMissing.length > 0) {
      const fromKitsu = await this.lookupKitsuBatch(stillMissing);
      for (const [id, summary] of fromKitsu) {
        result.set(id, summary);
        usedKitsu = true;
      }
    }

    if (result.size === 0) {
      this.noteProvider("unavailable");
    } else if (usedKitsu) {
      this.noteProvider("kitsu");
    } else if (usedCache) {
      this.noteProvider("cache");
    } else if (usedAniList) {
      this.noteProvider("anilist");
    }

    return result;
  }

  // -------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------

  async searchAnime(params: AnimeSearchParams = {}): Promise<AnimePage> {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const perPage = Math.max(1, Math.min(50, Math.trunc(params.perPage ?? 24)));

    await this.metadataCache.ready();

    if (!this.isUpstreamBlocked()) {
      try {
        const pageResult = await this.anilistClient.searchAnime(params);
        this.metadataCache.putSummaries(pageResult.items);
        this.noteAniListSuccess();
        this.noteProvider("anilist");
        // An empty page from a healthy API is a genuine zero-result search.
        return pageResult;
      } catch (error) {
        if (!this.isOutageError(error)) {
          throw error;
        }
        this.recordOutage(error);
      }
    }

    return this.fallbackSearchCached(params.query?.trim(), page, perPage);
  }

  /**
   * Coalesces concurrent degraded searches and briefly caches their result, so
   * an outage cannot turn search-as-you-type into a Kitsu request storm.
   */
  private async fallbackSearchCached(
    search: string | undefined,
    page: number,
    perPage: number,
  ): Promise<AnimePage> {
    const key = `${search ?? ""}::${page}::${perPage}`;
    const cached = this.fallbackSearches.get(key);
    if (cached) {
      return cached;
    }

    const existing = this.fallbackSearchesInFlight.get(key);
    if (existing) {
      return existing;
    }

    const request = this.fallbackSearch(search, page, perPage)
      .then((result) => {
        this.fallbackSearches.set(key, result, FALLBACK_SEARCH_TTL_MS);
        return result;
      })
      .finally(() => {
        this.fallbackSearchesInFlight.delete(key);
      });

    this.fallbackSearchesInFlight.set(key, request);
    return request;
  }

  private async fallbackSearch(
    search: string | undefined,
    page: number,
    perPage: number,
  ): Promise<AnimePage> {
    if (search) {
      const kitsu = await this.kitsuClient.searchAnime(
        search,
        perPage,
        (page - 1) * perPage,
      );

      if (kitsu.kind === "error") {
        this.warnKitsu(kitsu.error.message);
      } else if (kitsu.items.length > 0) {
        this.metadataCache.putSummaries(kitsu.items);
        this.noteProvider("kitsu");
        const lastPage =
          kitsu.total !== null
            ? Math.max(1, Math.ceil(kitsu.total / perPage))
            : null;
        return {
          items: kitsu.items,
          pageInfo: {
            currentPage: page,
            lastPage,
            hasNextPage:
              lastPage !== null ? page < lastPage : kitsu.items.length >= perPage,
            total: kitsu.total,
          },
        };
      }

      const local = this.metadataCache.searchLocal(search, perPage * page, {
        allowStale: true,
      });
      if (local.length > 0) {
        this.noteProvider("cache");
        return cachedPage(local, page, perPage);
      }
    } else {
      // Browsing with no query: cached popular is the only safe fallback.
      // Kitsu listings carry no verified AniList IDs, so they are not used.
      const popular =
        this.metadataCache.getPopular() ??
        this.metadataCache.getPopular({ allowStale: true });
      if (popular && popular.data.length > 0) {
        this.noteProvider("cache");
        return cachedPage(popular.data, page, perPage);
      }
    }

    this.noteProvider("unavailable");
    throw this.unavailable(
      "The anime catalogue cannot answer this search right now",
    );
  }

  // -------------------------------------------------------------------
  // Collections
  // -------------------------------------------------------------------

  async getPopularAnime(
    options: { page?: number; perPage?: number } = {},
  ): Promise<AnimePage> {
    const page = Math.max(1, Math.trunc(options.page ?? 1));
    const perPage = Math.max(1, Math.min(50, Math.trunc(options.perPage ?? 12)));

    await this.metadataCache.ready();

    if (!this.isUpstreamBlocked()) {
      try {
        const pageResult = await this.anilistClient.getPopularAnime(options);
        this.metadataCache.putPopular(pageResult.items);
        this.metadataCache.putSummaries(pageResult.items);
        this.noteAniListSuccess();
        this.noteProvider("anilist");
        return pageResult;
      } catch (error) {
        if (!this.isOutageError(error)) throw error;
        this.recordOutage(error);
      }
    }

    const cached =
      this.metadataCache.getPopular() ??
      this.metadataCache.getPopular({ allowStale: true });
    if (cached && cached.data.length > 0) {
      this.noteProvider("cache");
      return cachedPage(cached.data, page, perPage);
    }

    this.noteProvider("unavailable");
    throw this.unavailable("Popular anime are unavailable");
  }

  async getTrendingAnime(
    options: { page?: number; perPage?: number } = {},
  ): Promise<AnimePage> {
    const page = Math.max(1, Math.trunc(options.page ?? 1));
    const perPage = Math.max(1, Math.min(50, Math.trunc(options.perPage ?? 12)));

    await this.metadataCache.ready();

    if (!this.isUpstreamBlocked()) {
      try {
        const pageResult = await this.anilistClient.getTrendingAnime(options);
        this.metadataCache.putTrending(pageResult.items);
        this.metadataCache.putSummaries(pageResult.items);
        this.noteAniListSuccess();
        this.noteProvider("anilist");
        return pageResult;
      } catch (error) {
        if (!this.isOutageError(error)) throw error;
        this.recordOutage(error);
      }
    }

    const cached =
      this.metadataCache.getTrending() ??
      this.metadataCache.getTrending({ allowStale: true });
    if (cached && cached.data.length > 0) {
      this.noteProvider("cache");
      return cachedPage(cached.data, page, perPage);
    }

    this.noteProvider("unavailable");
    throw this.unavailable("Trending anime are unavailable");
  }

  async getSeasonalAnime(
    season: AnimeSeason,
    seasonYear: number,
    options: { page?: number; perPage?: number } = {},
  ): Promise<AnimePage> {
    const page = Math.max(1, Math.trunc(options.page ?? 1));
    const perPage = Math.max(1, Math.min(50, Math.trunc(options.perPage ?? 12)));

    await this.metadataCache.ready();

    if (!this.isUpstreamBlocked()) {
      try {
        const pageResult = await this.anilistClient.getSeasonalAnime(
          season,
          seasonYear,
          options,
        );
        this.metadataCache.putSeasonal(season, seasonYear, pageResult.items);
        this.metadataCache.putSummaries(pageResult.items);
        this.noteAniListSuccess();
        this.noteProvider("anilist");
        return pageResult;
      } catch (error) {
        if (!this.isOutageError(error)) throw error;
        this.recordOutage(error);
      }
    }

    const cached =
      this.metadataCache.getSeasonal(season, seasonYear) ??
      this.metadataCache.getSeasonal(season, seasonYear, { allowStale: true });
    if (cached && cached.data.length > 0) {
      this.noteProvider("cache");
      return cachedPage(cached.data, page, perPage);
    }

    this.noteProvider("unavailable");
    throw this.unavailable("Seasonal anime are unavailable");
  }

  // -------------------------------------------------------------------
  // Airing schedule (provider-only; no safe cached substitute exists)
  // -------------------------------------------------------------------

  async getAiringSchedule(params: {
    airingAtGreater: number;
    airingAtLesser: number;
    mediaIds?: number[];
    perPage?: number;
  }): Promise<AiringScheduleEntry[]> {
    if (this.isUpstreamBlocked()) {
      this.noteProvider("unavailable");
      throw this.unavailable(
        "The airing schedule is unavailable while AniList is offline",
      );
    }

    try {
      const entries = await this.anilistClient.getAiringSchedule(params);
      this.noteAniListSuccess();
      this.noteProvider("anilist");
      return entries;
    } catch (error) {
      if (!this.isOutageError(error)) throw error;
      this.recordOutage(error);
      this.noteProvider("unavailable");
      throw this.unavailable("The airing schedule is temporarily unavailable");
    }
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private isUpstreamBlocked(): boolean {
    return this.anilistClient.circuitBreaker.isBlocked();
  }

  private noteProvider(provider: CatalogProvider): void {
    this.lastProvider = provider;
  }

  private noteAniListSuccess(): void {
    this.suspensionConfirmedAt = null;
    this.rateLimitedAt = null;
    this.lastRetryAfterMs = null;
  }

  private recordOutage(error: unknown): void {
    if (
      error instanceof AniListSuspendedError ||
      (error instanceof AniListError &&
        (error.isSuspended || error.status === 403))
    ) {
      this.suspensionConfirmedAt = this.now();
      return;
    }

    if (error instanceof AniListError && error.status === 429) {
      this.rateLimitedAt = this.now();
      this.lastRetryAfterMs = error.retryAfterMs;
      return;
    }

    if (!(error instanceof CircuitBreakerOpenError)) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.warn("[catalog] AniList unavailable, using fallback:", message);
    }
  }

  private unavailableReason():
    | "upstream_suspended"
    | "upstream_unavailable"
    | "rate_limited" {
    if (this.suspensionConfirmedAt !== null) return "upstream_suspended";
    if (this.rateLimitedAt !== null) return "rate_limited";
    return "upstream_unavailable";
  }

  /** Builds a safe, actionable unavailable error for the API layer. */
  private unavailable(message: string): CatalogUnavailableError {
    return new CatalogUnavailableError(message, {
      reason: this.unavailableReason(),
      retryAfterMs: this.lastRetryAfterMs,
    });
  }

  private isMissingError(error: unknown): boolean {
    return (
      error instanceof AniListError &&
      (error.status === 404 ||
        (error.status === 400 && /not found/i.test(error.message)))
    );
  }

  /** True only for failures that justify serving fallback data. */
  private isOutageError(error: unknown): boolean {
    if (error instanceof AniListSuspendedError) return true;
    if (error instanceof CircuitBreakerOpenError) return true;
    if (error instanceof AniListError) {
      if (error.isSuspended || error.status === 403) return true;
      if (error.status === 429) return true;
      // Network failures, timeouts and the client's own errors carry no status.
      if (error.status === null) return true;
      return error.status >= 500;
    }
    return false;
  }

  private warnKitsu(message: string): void {
    const now = this.now();
    if (now - this.lastKitsuWarningAt < KITSU_WARNING_INTERVAL_MS) {
      return;
    }
    this.lastKitsuWarningAt = now;
    console.warn("[catalog] Kitsu fallback unavailable:", message);
  }

  /**
   * Deduplicated, negatively cached Kitsu lookup. Failures are logged once per
   * interval and never thrown into unrelated features.
   */
  private async lookupKitsu(
    id: number,
  ): Promise<KitsuLookupResult | null> {
    const missUntil = this.kitsuMisses.get(id);
    if (missUntil !== undefined && this.now() < missUntil) {
      return null;
    }

    const existing = this.kitsuInFlight.get(id);
    if (existing) {
      return existing;
    }

    const request = this.kitsuClient
      .getAnimeByAnilistId(id)
      .then((result) => {
        if (result.kind === "not_mapped" || result.kind === "ambiguous") {
          this.kitsuMisses.set(id, this.now() + KITSU_MISS_TTL_MS);
        }
        if (result.kind === "error") {
          this.warnKitsu(result.error.message);
        }
        return result;
      })
      .catch((error: unknown) => {
        this.warnKitsu(
          error instanceof Error ? error.message : "unexpected Kitsu failure",
        );
        return null;
      })
      .finally(() => {
        this.kitsuInFlight.delete(id);
      });

    this.kitsuInFlight.set(id, request);
    return request;
  }

  private async lookupKitsuBatch(
    ids: number[],
  ): Promise<Map<number, AnimeSummary>> {
    const found = new Map<number, AnimeSummary>();
    const queue = [...ids];
    let providerDown = false;

    const workers = Array.from(
      { length: Math.min(KITSU_CONCURRENCY, queue.length) },
      async () => {
        while (!providerDown) {
          const id = queue.shift();
          if (id === undefined) return;

          const result = await this.lookupKitsu(id);
          if (!result) continue;

          if (result.kind === "found") {
            found.set(id, result.summary);
            this.metadataCache.putSummary(result.summary);
          } else if (result.kind === "error") {
            // Stop hammering Kitsu once it has failed; entries stay unresolved.
            providerDown = true;
            return;
          }
        }
      },
    );

    await Promise.all(workers);
    return found;
  }

  private summaryToDetailedAnime(summary: AnimeSummary): Anime {
    // Degraded details: keep verified fields, never invent the missing ones.
    return {
      ...summary,
      bannerImage: null,
      synopsis: null,
      tags: [],
      season: null,
      duration: null,
      popularity: null,
      startDate: null,
      endDate: null,
      relations: [],
    };
  }
}

let defaultCatalogService: CatalogService | null = null;

export function getCatalogService(): CatalogService {
  defaultCatalogService ??= new CatalogService();
  return defaultCatalogService;
}
