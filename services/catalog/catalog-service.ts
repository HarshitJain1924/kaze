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

/** Provider that actually answered one catalogue operation. */
export type CatalogProvider = "anilist" | "kitsu" | "cache" | "unavailable";

/**
 * Diagnostic view of upstream health for a single server instance. This is
 * intentionally separate from the provider that served a response: an open
 * circuit does not mean Kitsu (or anything else) answered.
 */
export interface CatalogHealth {
  circuitBreakerState: CircuitState;
  /** True only after a confirmed AniList suspension (403 / disabled message). */
  isSuspended: boolean;
  suspensionConfirmedAt: number | null;
  cachedTitlesCount: number;
}

export interface CatalogResultMeta {
  /** Provider that produced this response. Never inferred from breaker state. */
  provider: CatalogProvider;
  /** True when the response was not served live by AniList. */
  degraded: boolean;
  /** True when stale cached metadata was served during an outage. */
  stale: boolean;
  /** Cache timestamp for cache-served data, otherwise `null`. */
  cachedAt: number | null;
  /** Upstream health at the time of the operation (diagnostic only). */
  health: CatalogHealth;
}

export interface CatalogResult<T> {
  data: T;
  meta: CatalogResultMeta;
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

interface OutageSignal {
  /** True once any upstream read for this operation failed. */
  failed: boolean;
  suspended: boolean;
  rateLimited: boolean;
  retryAfterMs: number | null;
}

interface FallbackPage {
  page: AnimePage;
  provider: CatalogProvider;
  stale: boolean;
  cachedAt: number | null;
}

function toSummary(anime: Anime): AnimeSummary {
  return {
    id: anime.id,
    title: anime.title,
    coverImage: anime.coverImage,
    bannerImage: anime.bannerImage,
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
 * Every read returns a {@link CatalogResult} carrying the provider that
 * actually served it plus freshness metadata, so concurrent requests cannot
 * relabel each other's responses. Only public provider metadata is cached;
 * user-owned library and episode-tracking records never enter this cache.
 */
export class CatalogService {
  readonly anilistClient: AniListClient;
  readonly metadataCache: MetadataCache;
  readonly kitsuClient: KitsuClient;

  private readonly now: () => number;

  /**
   * Diagnostic only: set when AniList itself confirms a suspension and
   * cleared on the next healthy response. Never used to label a response's
   * provider.
   */
  private suspensionConfirmedAt: number | null = null;

  private readonly kitsuInFlight = new Map<
    number,
    Promise<KitsuLookupResult | null>
  >();
  /** IDs known to have no usable Kitsu mapping, to avoid repeat lookups. */
  private readonly kitsuMisses = new Map<number, number>();
  private lastKitsuWarningAt = 0;
  /** Short-lived cache for degraded search results to avoid fallback storms. */
  private readonly fallbackSearches = new TtlCache<FallbackPage>(
    FALLBACK_SEARCH_CACHE_ENTRIES,
  );
  private readonly fallbackSearchesInFlight = new Map<
    string,
    Promise<FallbackPage>
  >();

  constructor(options: CatalogServiceOptions = {}) {
    this.anilistClient = options.anilistClient ?? getAniListClient();
    this.metadataCache = options.metadataCache ?? getMetadataCache();
    this.kitsuClient = options.kitsuClient ?? getKitsuClient();
    this.now = options.now ?? Date.now.bind(Date);
  }

  /** Diagnostic upstream health; contains no per-response provider field. */
  getHealth(): CatalogHealth {
    const breaker = this.anilistClient.circuitBreaker.getState();
    return {
      circuitBreakerState: breaker.state,
      isSuspended: this.suspensionConfirmedAt !== null,
      suspensionConfirmedAt: this.suspensionConfirmedAt,
      cachedTitlesCount: this.metadataCache.size,
    };
  }

  resetCircuitBreaker(): void {
    this.anilistClient.circuitBreaker.reset();
  }

  // -------------------------------------------------------------------
  // Single anime
  // -------------------------------------------------------------------

  async getAnimeById(id: number): Promise<CatalogResult<Anime | null>> {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AniListError("Invalid anime id");
    }

    await this.metadataCache.ready();
    const signal = this.newOutageSignal();

    if (!this.isUpstreamBlocked()) {
      try {
        const anime = await this.anilistClient.getAnimeById(id);
        this.noteAniListSuccess();

        if (!anime) {
          // A genuine "this anime does not exist" answer from a healthy API.
          return this.result(null, "anilist");
        }

        // Opportunistically upgrade banner & poster images with high-resolution Kitsu assets
        try {
          const kitsu = await this.lookupKitsu(id);
          if (kitsu?.kind === "found") {
            if (kitsu.bannerImage) {
              anime.bannerImage = kitsu.bannerImage;
            }
            if (kitsu.summary.coverImage.extraLarge) {
              anime.coverImage = {
                ...anime.coverImage,
                extraLarge: kitsu.summary.coverImage.extraLarge,
              };
            }
          }
        } catch {
          // Any Kitsu failure is completely non-fatal to live details delivery
        }

        this.metadataCache.putDetails(anime);
        this.metadataCache.putSummary(toSummary(anime));
        return this.result(anime, "anilist");
      } catch (error) {
        if (this.isMissingError(error)) {
          this.noteAniListSuccess();
          return this.result(null, "anilist");
        }
        if (!this.isOutageError(error)) {
          throw error;
        }
        this.recordOutage(error, signal);
      }
    }

    const freshDetails = this.metadataCache.getDetails(id);
    if (freshDetails) {
      return this.result(freshDetails.data, "cache", {
        stale: freshDetails.isStale,
        cachedAt: freshDetails.cachedAt,
      });
    }
    const freshSummary = this.metadataCache.getSummary(id);
    if (freshSummary) {
      return this.result(this.summaryToDetailedAnime(freshSummary.data), "cache", {
        stale: freshSummary.isStale,
        cachedAt: freshSummary.cachedAt,
      });
    }
    const staleDetails = this.metadataCache.getDetails(id, {
      allowStale: true,
    });
    if (staleDetails) {
      return this.result(staleDetails.data, "cache", {
        stale: staleDetails.isStale,
        cachedAt: staleDetails.cachedAt,
      });
    }
    const staleSummary = this.metadataCache.getSummary(id, {
      allowStale: true,
    });
    if (staleSummary) {
      return this.result(this.summaryToDetailedAnime(staleSummary.data), "cache", {
        stale: staleSummary.isStale,
        cachedAt: staleSummary.cachedAt,
      });
    }

    const kitsu = await this.lookupKitsu(id);
    if (kitsu?.kind === "found") {
      this.metadataCache.putSummary(kitsu.summary);
      const detailed = this.summaryToDetailedAnime(kitsu.summary);
      if (kitsu.bannerImage) {
        detailed.bannerImage = kitsu.bannerImage;
      }
      return this.result(detailed, "kitsu");
    }

    throw this.unavailable("Anime details are temporarily unavailable", signal);
  }

  // -------------------------------------------------------------------
  // Library hydration
  // -------------------------------------------------------------------

  /**
   * Resolves summaries for library entries. IDs that cannot be resolved are
   * simply absent from the returned map, so callers keep the user's entry,
   * progress, rating and notes with `anime: null`.
   */
  async getAnimeByIds(
    ids: number[],
  ): Promise<CatalogResult<Map<number, AnimeSummary>>> {
    const unique = [
      ...new Set(ids.filter((id) => Number.isInteger(id) && id > 0)),
    ];
    if (unique.length === 0) {
      return this.result(new Map<number, AnimeSummary>(), "unavailable");
    }

    await this.metadataCache.ready();
    const signal = this.newOutageSignal();

    const result = new Map<number, AnimeSummary>();
    let usedAniList = false;
    let usedCache = false;
    let usedKitsu = false;
    let liveAttempted = false;
    let stale = false;
    let cachedAt: number | null = null;

    const markCached = (hit: { isStale: boolean; cachedAt: number }) => {
      usedCache = true;
      stale = stale || hit.isStale;
      cachedAt =
        cachedAt === null ? hit.cachedAt : Math.min(cachedAt, hit.cachedAt);
    };

    const fresh = this.metadataCache.getSummaries(unique);
    for (const [id, hit] of fresh.hits) {
      result.set(id, hit.data);
      markCached(hit);
    }

    const blocked = this.isUpstreamBlocked();
    const needsRefresh = unique.filter((id) => !result.has(id));
    if (needsRefresh.length > 0 && !blocked) {
      liveAttempted = true;
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
        this.recordOutage(error, signal);
      }
    }

    // Stale data and Kitsu are outage fallbacks only. If AniList answered
    // successfully, an omitted ID is genuinely missing and must not be
    // backfilled with stale metadata.
    const primaryUnavailable = blocked || signal.failed;
    const missingAfterLive = unique.filter((id) => !result.has(id));
    if (primaryUnavailable && missingAfterLive.length > 0) {
      const staleHits = this.metadataCache.getSummaries(missingAfterLive, {
        allowStale: true,
      });
      for (const [id, hit] of staleHits.hits) {
        result.set(id, hit.data);
        markCached(hit);
      }
    }

    // Only then ask Kitsu, with verified AniList mappings and bounded fan-out.
    const stillMissing = unique.filter((id) => !result.has(id));
    if (primaryUnavailable && stillMissing.length > 0) {
      const fromKitsu = await this.lookupKitsuBatch(stillMissing);
      for (const [id, summary] of fromKitsu) {
        result.set(id, summary);
        usedKitsu = true;
      }
    }

    const primarySucceeded = liveAttempted && !signal.failed;
    const provider: CatalogProvider =
      result.size === 0
        ? primarySucceeded
          ? "anilist"
          : "unavailable"
        : usedKitsu
          ? "kitsu"
          : usedCache
            ? "cache"
            : usedAniList
              ? "anilist"
              : "unavailable";

    return this.result(result, provider, { stale, cachedAt });
  }

  // -------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------

  async searchAnime(
    params: AnimeSearchParams = {},
  ): Promise<CatalogResult<AnimePage>> {
    const page = Math.max(1, Math.trunc(params.page ?? 1));
    const perPage = Math.max(1, Math.min(50, Math.trunc(params.perPage ?? 24)));

    await this.metadataCache.ready();
    const signal = this.newOutageSignal();

    if (!this.isUpstreamBlocked()) {
      try {
        const pageResult = await this.anilistClient.searchAnime(params);
        this.metadataCache.putSummaries(pageResult.items);
        this.noteAniListSuccess();
        // An empty page from a healthy API is a genuine zero-result search.
        return this.result(pageResult, "anilist");
      } catch (error) {
        if (!this.isOutageError(error)) {
          throw error;
        }
        this.recordOutage(error, signal);
      }
    }

    const fallback = await this.fallbackSearchCached(
      params,
      page,
      perPage,
      signal,
    );

    return this.result(fallback.page, fallback.provider, {
      stale: fallback.stale,
      cachedAt: fallback.cachedAt,
    });
  }

  /**
   * Coalesces concurrent degraded searches and briefly caches their result, so
   * an outage cannot turn search-as-you-type into a Kitsu request storm.
   */
  private async fallbackSearchCached(
    params: AnimeSearchParams,
    page: number,
    perPage: number,
    signal: OutageSignal,
  ): Promise<FallbackPage> {
    // Filters are part of the key so a degraded search never serves results
    // that were requested with a different filter set.
    const filterKey = [
      params.genre,
      params.format,
      params.status,
      params.season,
      params.seasonYear,
      params.source,
      params.countryOfOrigin,
      params.sort,
    ]
      .map((value) => value ?? "")
      .join("~");
    const search = params.query?.trim();
    const key = `${search ?? ""}::${filterKey}::${page}::${perPage}`;
    const cached = this.fallbackSearches.get(key);
    if (cached) {
      return cached;
    }

    const existing = this.fallbackSearchesInFlight.get(key);
    if (existing) {
      return existing;
    }

    const request = this.fallbackSearch(search, page, perPage, signal)
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
    signal: OutageSignal,
  ): Promise<FallbackPage> {
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
        const lastPage =
          kitsu.total !== null
            ? Math.max(1, Math.ceil(kitsu.total / perPage))
            : null;
        return {
          page: {
            items: kitsu.items,
            pageInfo: {
              currentPage: page,
              lastPage,
              hasNextPage:
                lastPage !== null
                  ? page < lastPage
                  : kitsu.items.length >= perPage,
              total: kitsu.total,
            },
          },
          provider: "kitsu",
          stale: false,
          cachedAt: null,
        };
      }

      const localHits = this.metadataCache.searchLocalHits(
        search,
        perPage * page,
        { allowStale: true },
      );
      if (localHits.length > 0) {
        const stale = localHits.some((hit) => hit.isStale);
        const cachedAt = Math.min(...localHits.map((hit) => hit.cachedAt));
        return {
          page: cachedPage(
            localHits.map((hit) => hit.data),
            page,
            perPage,
          ),
          provider: "cache",
          stale,
          cachedAt,
        };
      }
    } else {
      // Browsing with no query: cached popular is the only safe fallback.
      // Kitsu listings carry no verified AniList IDs, so they are not used.
      const popular =
        this.metadataCache.getPopular() ??
        this.metadataCache.getPopular({ allowStale: true });
      if (popular && popular.data.length > 0) {
        return {
          page: cachedPage(popular.data, page, perPage),
          provider: "cache",
          stale: popular.isStale,
          cachedAt: popular.cachedAt,
        };
      }
    }

    throw this.unavailable(
      "The anime catalogue cannot answer this search right now",
      signal,
    );
  }

  // -------------------------------------------------------------------
  // Collections
  // -------------------------------------------------------------------

  async getPopularAnime(
    options: { page?: number; perPage?: number } = {},
  ): Promise<CatalogResult<AnimePage>> {
    return this.getCollectionPage("popular", options);
  }

  async getTrendingAnime(
    options: { page?: number; perPage?: number } = {},
  ): Promise<CatalogResult<AnimePage>> {
    return this.getCollectionPage("trending", options);
  }

  async getSeasonalAnime(
    season: AnimeSeason,
    seasonYear: number,
    options: { page?: number; perPage?: number } = {},
  ): Promise<CatalogResult<AnimePage>> {
    return this.getCollectionPage("seasonal", options, { season, seasonYear });
  }

  private async getCollectionPage(
    kind: "popular" | "trending" | "seasonal",
    options: { page?: number; perPage?: number },
    seasonal?: { season: AnimeSeason; seasonYear: number },
  ): Promise<CatalogResult<AnimePage>> {
    const page = Math.max(1, Math.trunc(options.page ?? 1));
    const perPage = Math.max(1, Math.min(50, Math.trunc(options.perPage ?? 12)));

    await this.metadataCache.ready();
    const signal = this.newOutageSignal();

    if (!this.isUpstreamBlocked()) {
      try {
        const pageResult = seasonal
          ? await this.anilistClient.getSeasonalAnime(
              seasonal.season,
              seasonal.seasonYear,
              options,
            )
          : kind === "popular"
            ? await this.anilistClient.getPopularAnime(options)
            : await this.anilistClient.getTrendingAnime(options);

        if (seasonal) {
          this.metadataCache.putSeasonal(
            seasonal.season,
            seasonal.seasonYear,
            pageResult.items,
          );
        } else if (kind === "popular") {
          this.metadataCache.putPopular(pageResult.items);
        } else {
          this.metadataCache.putTrending(pageResult.items);
        }
        this.metadataCache.putSummaries(pageResult.items);
        this.noteAniListSuccess();
        return this.result(pageResult, "anilist");
      } catch (error) {
        if (!this.isOutageError(error)) throw error;
        this.recordOutage(error, signal);
      }
    }

    const cached = seasonal
      ? (this.metadataCache.getSeasonal(
          seasonal.season,
          seasonal.seasonYear,
        ) ??
        this.metadataCache.getSeasonal(
          seasonal.season,
          seasonal.seasonYear,
          { allowStale: true },
        ))
      : kind === "popular"
        ? (this.metadataCache.getPopular() ??
          this.metadataCache.getPopular({ allowStale: true }))
        : (this.metadataCache.getTrending() ??
          this.metadataCache.getTrending({ allowStale: true }));

    if (cached && cached.data.length > 0) {
      return this.result(cachedPage(cached.data, page, perPage), "cache", {
        stale: cached.isStale,
        cachedAt: cached.cachedAt,
      });
    }

    const label =
      kind === "popular"
        ? "Popular anime are unavailable"
        : kind === "trending"
          ? "Trending anime are unavailable"
          : "Seasonal anime are unavailable";
    throw this.unavailable(label, signal);
  }

  // -------------------------------------------------------------------
  // Airing schedule (provider-only; no safe cached substitute exists)
  // -------------------------------------------------------------------

  async getAiringSchedule(params: {
    airingAtGreater: number;
    airingAtLesser: number;
    mediaIds?: number[];
    perPage?: number;
  }): Promise<CatalogResult<AiringScheduleEntry[]>> {
    const signal = this.newOutageSignal();

    if (this.isUpstreamBlocked()) {
      throw this.unavailable(
        "The airing schedule is unavailable while AniList is offline",
        signal,
      );
    }

    try {
      const entries = await this.anilistClient.getAiringSchedule(params);
      this.noteAniListSuccess();
      return this.result(entries, "anilist");
    } catch (error) {
      if (!this.isOutageError(error)) throw error;
      this.recordOutage(error, signal);
      throw this.unavailable(
        "The airing schedule is temporarily unavailable",
        signal,
      );
    }
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private newOutageSignal(): OutageSignal {
    // Seed the failure reason from diagnostics without touching provider
    // attribution; the provider is decided per operation.
    return {
      failed: false,
      suspended: this.suspensionConfirmedAt !== null,
      rateLimited: false,
      retryAfterMs: null,
    };
  }

  private isUpstreamBlocked(): boolean {
    return this.anilistClient.circuitBreaker.isBlocked();
  }

  private noteAniListSuccess(): void {
    this.suspensionConfirmedAt = null;
  }

  private recordOutage(error: unknown, signal: OutageSignal): void {
    signal.failed = true;

    if (this.isConfirmedSuspension(error)) {
      signal.suspended = true;
      this.suspensionConfirmedAt = this.now();
      return;
    }

    if (error instanceof AniListError && error.status === 429) {
      signal.rateLimited = true;
      signal.retryAfterMs = error.retryAfterMs;
      return;
    }

    if (!(error instanceof CircuitBreakerOpenError)) {
      const message = error instanceof Error ? error.message : "unknown error";
      console.warn("[catalog] AniList unavailable, using fallback:", message);
    }
  }

  private isConfirmedSuspension(error: unknown): boolean {
    return (
      error instanceof AniListSuspendedError ||
      (error instanceof AniListError &&
        (error.isSuspended || error.status === 403))
    );
  }

  /** Builds a safe, actionable unavailable error for the API layer. */
  private unavailable(
    message: string,
    signal: OutageSignal,
  ): CatalogUnavailableError {
    const reason = signal.suspended
      ? "upstream_suspended"
      : signal.rateLimited
        ? "rate_limited"
        : "upstream_unavailable";

    return new CatalogUnavailableError(message, {
      reason,
      retryAfterMs: signal.rateLimited ? signal.retryAfterMs : null,
    });
  }

  private result<T>(
    data: T,
    provider: CatalogProvider,
    options: { stale?: boolean; cachedAt?: number | null } = {},
  ): CatalogResult<T> {
    return {
      data,
      meta: {
        provider,
        degraded: provider !== "anilist",
        stale: options.stale ?? false,
        cachedAt: options.cachedAt ?? null,
        health: this.getHealth(),
      },
    };
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
      bannerImage: summary.bannerImage ?? null,
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
