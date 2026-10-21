import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AniListClient } from "@/services/anilist/client";
import { CircuitBreaker } from "@/services/anilist/circuit-breaker";
import { CatalogService } from "@/services/catalog/catalog-service";
import { CatalogUnavailableError } from "@/services/catalog/errors";
import { KitsuClient } from "@/services/catalog/kitsu-client";
import type { MetadataCache } from "@/services/catalog/metadata-cache";
import type { LibraryEntry } from "@/types/library";

import {
  anilistDetailsResponse,
  anilistPageResponse,
  createTestCache,
  jsonResponse,
  kitsuMappingResponse,
  kitsuSearchResponse,
  makeSummary,
  suspensionResponse,
} from "./helpers/catalog-fixtures";

const HOUR = 60 * 60 * 1000;

interface CatalogHarnessOptions {
  cache?: MetadataCache;
  circuitBreaker?: CircuitBreaker;
  fetchImpl?: ReturnType<typeof vi.fn>;
  kitsuFetch?: ReturnType<typeof vi.fn>;
  now?: () => number;
  maxRetries?: number;
}

function createCatalog(options: CatalogHarnessOptions = {}) {
  const fetchImpl =
    options.fetchImpl ?? vi.fn(async () => anilistPageResponse([]));
  const kitsuFetch =
    options.kitsuFetch ??
    vi.fn(async () => jsonResponse({ data: [], meta: { count: 0 } }));

  const cache = options.cache ?? createTestCache();
  const anilistClient = new AniListClient({
    fetchImpl: fetchImpl as unknown as typeof fetch,
    circuitBreaker: options.circuitBreaker,
    maxRetries: options.maxRetries ?? 0,
    sleep: async () => {},
    random: () => 0,
    baseBackoffMs: 1,
    maxBackoffMs: 10,
    timeoutMs: 1000,
    now: options.now,
  });
  const kitsuClient = new KitsuClient({
    fetchImpl: kitsuFetch as unknown as typeof fetch,
    timeoutMs: 1000,
  });

  return {
    catalog: new CatalogService({
      anilistClient,
      metadataCache: cache,
      kitsuClient,
      now: options.now,
    }),
    cache,
    fetchImpl,
    kitsuFetch,
  };
}

function emptyKitsu() {
  return vi.fn(async () => jsonResponse({ data: [], meta: { count: 0 } }));
}

describe("Catalogue outage resilience", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("AniList suspension and rate limits", () => {
    it("does not retry a confirmed suspension and reports it accurately", async () => {
      const circuitBreaker = new CircuitBreaker({ cooldownMs: 5000 });
      let fetchCallCount = 0;
      const fetchMock = vi.fn(async () => {
        fetchCallCount += 1;
        return suspensionResponse();
      });

      const { catalog } = createCatalog({
        fetchImpl: fetchMock,
        circuitBreaker,
        maxRetries: 3,
        kitsuFetch: emptyKitsu(),
      });

      const error = await catalog
        .getAnimeById(154587)
        .then(() => null)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(CatalogUnavailableError);
      expect((error as CatalogUnavailableError).reason).toBe(
        "upstream_suspended",
      );

      // A suspension must never be retried in a tight loop.
      expect(fetchCallCount).toBe(1);
      expect(circuitBreaker.getState().state).toBe("OPEN");

      const health = catalog.getHealth();
      expect(health.isSuspended).toBe(true);
      expect(health.circuitBreakerState).toBe("OPEN");
      // Health carries no provider attribution.
      expect(Object.keys(health)).not.toContain("activeProvider");
      expect(Object.keys(health)).not.toContain("lastProvider");

      await expect(catalog.getAnimeById(154587)).rejects.toBeInstanceOf(
        CatalogUnavailableError,
      );
      expect(fetchCallCount).toBe(1);
    });

    it("surfaces a rate-limit reason when the retry budget is exhausted", async () => {
      const circuitBreaker = new CircuitBreaker({ failureThreshold: 5 });
      const fetchMock = vi.fn(
        async () =>
          new Response("", {
            status: 429,
            headers: { "retry-after": "120" },
          }),
      );

      const { catalog } = createCatalog({
        circuitBreaker,
        fetchImpl: fetchMock,
        kitsuFetch: emptyKitsu(),
        maxRetries: 2,
      });

      const error = await catalog
        .searchAnime({ query: "rate limited" })
        .then(() => null)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(CatalogUnavailableError);
      const unavailable = error as CatalogUnavailableError;
      expect(unavailable.reason).toBe("rate_limited");
      expect(unavailable.retryAfterMs).toBe(120_000);
      // Rate limiting is not a confirmed suspension.
      expect(catalog.getHealth().isSuspended).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("treats an open circuit from transient failures as degraded, not suspended", async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        cooldownMs: 5000,
      });
      const fetchMock = vi.fn(async () =>
        jsonResponse({ errors: [{ message: "boom" }] }, 500),
      );

      const { catalog } = createCatalog({
        fetchImpl: fetchMock,
        circuitBreaker,
        kitsuFetch: emptyKitsu(),
      });

      await expect(
        catalog.searchAnime({ query: "anything" }),
      ).rejects.toBeInstanceOf(CatalogUnavailableError);

      const health = catalog.getHealth();
      expect(health.circuitBreakerState).toBe("OPEN");
      // An open breaker alone is not proof of an upstream suspension.
      expect(health.isSuspended).toBe(false);
    });
  });

  describe("Operation-scoped provider metadata", () => {
    it("reports the provider that served each concurrent library request", async () => {
      const cache = createTestCache();
      cache.putSummary(makeSummary(1));

      let resolveFetch: ((value: Response) => void) | undefined;
      const fetchMock = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      );

      const { catalog } = createCatalog({ cache, fetchImpl: fetchMock });

      // One request is answered from cache immediately; the other is still
      // waiting on AniList. With shared mutable state the second request
      // would overwrite the first response's provider.
      const cachedRequest = catalog.getAnimeByIds([1]);
      const liveRequest = catalog.getAnimeByIds([2]);

      const cachedResult = await cachedRequest;
      expect(cachedResult.meta.provider).toBe("cache");
      expect(cachedResult.meta.degraded).toBe(true);
      expect(cachedResult.data.get(1)?.id).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      resolveFetch?.(anilistPageResponse([2]));

      const liveResult = await liveRequest;
      expect(liveResult.meta.provider).toBe("anilist");
      expect(liveResult.meta.degraded).toBe(false);
      expect(liveResult.data.get(2)?.id).toBe(2);

      // Earlier results are immutable snapshots, not live views of shared state.
      expect(cachedResult.meta.provider).toBe("cache");
    });

    it("keeps cache and Kitsu providers distinct during a concurrent outage", async () => {
      const cache = createTestCache();
      cache.putSummary(makeSummary(1));

      let resolveKitsu: ((value: Response) => void) | undefined;
      const kitsuFetch = vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveKitsu = resolve;
          }),
      );

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        kitsuFetch,
      });

      const cachedRequest = catalog.getAnimeById(1);
      const kitsuRequest = catalog.getAnimeById(154587);

      const cachedResult = await cachedRequest;
      expect(cachedResult.meta.provider).toBe("cache");
      expect(cachedResult.meta.stale).toBe(false);
      expect(cachedResult.meta.health.circuitBreakerState).toBe("OPEN");
      expect(cachedResult.meta.health.isSuspended).toBe(false);

      resolveKitsu?.(kitsuMappingResponse(154587, { kitsuId: "46474" }));

      const kitsuResult = await kitsuRequest;
      expect(kitsuResult.meta.provider).toBe("kitsu");
      expect(kitsuResult.data?.id).toBe(154587);
      expect(kitsuResult.meta.health.circuitBreakerState).toBe("OPEN");

      expect(cachedResult.meta.provider).toBe("cache");
    });

    it("carries freshness metadata for stale fallback responses", async () => {
      let now = 1_000_000;
      const cache = createTestCache({ now: () => now });
      cache.putSummary(makeSummary(7));

      const cachedAt = now;
      now += 13 * HOUR;

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        now: () => now,
      });

      const result = await catalog.getAnimeById(7);

      expect(result.meta.provider).toBe("cache");
      expect(result.meta.stale).toBe(true);
      expect(result.meta.cachedAt).toBe(cachedAt);
      expect(result.meta.degraded).toBe(true);
    });

    it("replays degraded search results with their original provider", async () => {
      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();
      const kitsuFetch = vi.fn(async () =>
        kitsuSearchResponse([{ anilistId: 100, kitsuId: "7001" }]),
      );

      const { catalog } = createCatalog({ circuitBreaker, kitsuFetch });

      const first = await catalog.searchAnime({ query: "frieren" });
      expect(first.meta.provider).toBe("kitsu");

      const second = await catalog.searchAnime({ query: "frieren" });
      expect(second.meta.provider).toBe("kitsu");
      expect(second.data.items.map((item) => item.id)).toEqual([100]);
      // The short-lived fallback cache coalesces repeat searches.
      expect(kitsuFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("Fallback ordering", () => {
    it("serves fresh cached details without contacting any provider", async () => {
      const cache = createTestCache();
      cache.putSummary(
        makeSummary(99999, {
          title: {
            english: "Cached Anime",
            romaji: "Cached Romaji",
            native: null,
          },
          episodes: 12,
        }),
      );

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const fetchMock = vi.fn(async () => {
        throw new Error("network must not be used");
      });
      const kitsuFetch = vi.fn(async () => {
        throw new Error("Kitsu must not be used");
      });

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        fetchImpl: fetchMock,
        kitsuFetch,
      });

      const details = await catalog.getAnimeById(99999);
      expect(details.data?.id).toBe(99999);
      expect(details.data?.title.english).toBe("Cached Anime");
      expect(details.data?.episodes).toBe(12);
      expect(details.meta.provider).toBe("cache");
      expect(details.meta.stale).toBe(false);
      expect(details.meta.degraded).toBe(true);

      const batch = await catalog.getAnimeByIds([99999]);
      expect(batch.data.get(99999)?.title.english).toBe("Cached Anime");
      expect(batch.meta.provider).toBe("cache");

      expect(fetchMock).not.toHaveBeenCalled();
      expect(kitsuFetch).not.toHaveBeenCalled();
    });

    it("drops expired cache entries and reports unavailability", async () => {
      let now = 1_000_000;
      const cache = createTestCache({ now: () => now });
      cache.putSummary(makeSummary(8));
      now += 12 * HOUR + 30 * 24 * HOUR + 1;

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        now: () => now,
      });

      await expect(catalog.getAnimeById(8)).rejects.toBeInstanceOf(
        CatalogUnavailableError,
      );

      const emptyBatch = await catalog.getAnimeByIds([8]);
      expect(emptyBatch.data.size).toBe(0);
      expect(emptyBatch.meta.provider).toBe("unavailable");
    });

    it("falls back to Kitsu only with a verified AniList mapping", async () => {
      const cache = createTestCache();
      const kitsuFetch = vi.fn(async () =>
        kitsuMappingResponse(154587, { kitsuId: "46474" }),
      );

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        kitsuFetch,
      });

      const result = await catalog.getAnimeById(154587);

      expect(result.data?.id).toBe(154587);
      expect(result.data?.title.english).toBe("Kitsu English 154587");
      expect(result.data?.episodes).toBe(24);
      expect(result.meta.provider).toBe("kitsu");
      expect(result.meta.stale).toBe(false);
      expect(cache.getSummary(154587)?.data.id).toBe(154587);
    });

    it("does not invent a result when Kitsu has no mapping", async () => {
      const cache = createTestCache();
      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        kitsuFetch: emptyKitsu(),
      });

      await expect(catalog.getAnimeById(154587)).rejects.toBeInstanceOf(
        CatalogUnavailableError,
      );
      expect(cache.getSummary(154587)).toBeNull();
    });

    it("distinguishes a missing anime from unavailable metadata", async () => {
      const fetchMock = vi.fn(async () =>
        jsonResponse({ data: { Media: null } }),
      );
      const kitsuFetch = emptyKitsu();

      const { catalog } = createCatalog({
        fetchImpl: fetchMock,
        kitsuFetch,
      });

      const result = await catalog.getAnimeById(4242);
      expect(result.data).toBeNull();
      expect(result.meta.provider).toBe("anilist");
      expect(result.meta.degraded).toBe(false);
      expect(kitsuFetch).not.toHaveBeenCalled();
    });

    it("throws unavailable instead of returning null when details cannot be loaded", async () => {
      const circuitBreaker = new CircuitBreaker({
        failureThreshold: 1,
        cooldownMs: 5000,
      });
      const fetchMock = vi.fn(async () =>
        jsonResponse({ errors: [{ message: "boom" }] }, 500),
      );

      const { catalog } = createCatalog({
        circuitBreaker,
        fetchImpl: fetchMock,
        kitsuFetch: emptyKitsu(),
      });

      await expect(catalog.getAnimeById(1)).rejects.toBeInstanceOf(
        CatalogUnavailableError,
      );
    });
  });

  describe("Search", () => {
    it("returns a genuine empty page when AniList is healthy", async () => {
      const { catalog } = createCatalog({
        fetchImpl: vi.fn(async () => anilistPageResponse([])),
      });

      const result = await catalog.searchAnime({ query: "no such title" });

      expect(result.data.items).toEqual([]);
      expect(result.data.pageInfo.total).toBe(0);
      expect(result.meta.provider).toBe("anilist");
      expect(result.meta.degraded).toBe(false);
    });

    it("throws an unavailable error on outage instead of faking an empty search", async () => {
      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache: createTestCache(),
        circuitBreaker,
        kitsuFetch: emptyKitsu(),
      });

      await expect(
        catalog.searchAnime({ query: "NonexistentAnimexyz" }),
      ).rejects.toBeInstanceOf(CatalogUnavailableError);
    });

    it("uses Kitsu search results with verified AniList IDs during an outage", async () => {
      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();
      const kitsuFetch = vi.fn(async () =>
        kitsuSearchResponse([
          { anilistId: 100, kitsuId: "7001" },
          { anilistId: 101, kitsuId: "7002" },
        ]),
      );

      const { catalog } = createCatalog({ circuitBreaker, kitsuFetch });

      const result = await catalog.searchAnime({ query: "frieren" });

      expect(result.data.items.map((item) => item.id)).toEqual([100, 101]);
      expect(result.data.pageInfo.total).toBe(2);
      expect(result.meta.provider).toBe("kitsu");
    });

    it("falls back to local cached titles when Kitsu has no matches", async () => {
      const cache = createTestCache();
      cache.putSummary(
        makeSummary(300, {
          title: {
            english: "Frieren: Beyond Journey's End",
            romaji: "Sousou no Frieren",
            native: null,
          },
        }),
      );

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        kitsuFetch: emptyKitsu(),
      });

      const result = await catalog.searchAnime({ query: "frieren" });

      expect(result.data.items.map((item) => item.id)).toEqual([300]);
      expect(result.meta.provider).toBe("cache");
      expect(result.meta.cachedAt).not.toBeNull();
    });

    it("falls back to cached popular titles for an empty browse query", async () => {
      const cache = createTestCache();
      cache.putPopular([makeSummary(1), makeSummary(2)]);

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({ cache, circuitBreaker });

      const result = await catalog.searchAnime({});

      expect(result.data.items.map((item) => item.id)).toEqual([1, 2]);
      expect(result.meta.provider).toBe("cache");
    });
  });

  describe("Collections", () => {
    it("serves cached seasonal results during an outage", async () => {
      const cache = createTestCache();
      cache.putSeasonal("FALL", 2026, [makeSummary(1), makeSummary(2)]);

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({ cache, circuitBreaker });

      const result = await catalog.getSeasonalAnime("FALL", 2026, {
        perPage: 12,
      });

      expect(result.data.items).toHaveLength(2);
      expect(result.data.pageInfo.total).toBe(2);
      expect(result.meta.provider).toBe("cache");
    });

    it("does not relabel the popular list as seasonal data", async () => {
      const cache = createTestCache();
      cache.putPopular([makeSummary(9)]);

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({ cache, circuitBreaker });

      await expect(
        catalog.getSeasonalAnime("FALL", 2026),
      ).rejects.toBeInstanceOf(CatalogUnavailableError);
    });

    it("does not relabel the popular list as trending data", async () => {
      const cache = createTestCache();
      cache.putPopular([makeSummary(9)]);

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({ cache, circuitBreaker });

      await expect(catalog.getTrendingAnime()).rejects.toBeInstanceOf(
        CatalogUnavailableError,
      );
    });

    it("serves cached popular results with pagination applied", async () => {
      const cache = createTestCache();
      cache.putPopular([1, 2, 3, 4, 5].map((id) => makeSummary(id)));

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({ cache, circuitBreaker });

      const result = await catalog.getPopularAnime({ page: 2, perPage: 2 });
      expect(result.data.items.map((item) => item.id)).toEqual([3, 4]);
      expect(result.data.pageInfo.hasNextPage).toBe(true);
      expect(result.data.pageInfo.lastPage).toBe(3);
      expect(result.meta.provider).toBe("cache");
    });
  });

  describe("Library hydration", () => {
    it("resolves what it can and omits unavailable entries", async () => {
      const cache = createTestCache();
      cache.putSummary(makeSummary(1));

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        kitsuFetch: emptyKitsu(),
      });

      const result = await catalog.getAnimeByIds([1, 2]);

      expect(result.data.get(1)?.id).toBe(1);
      expect(result.data.has(2)).toBe(false);
      expect(result.meta.provider).toBe("cache");
    });

    it("preserves user-owned fields when metadata is unavailable", async () => {
      const entry: LibraryEntry = {
        id: "entry-abc",
        userId: "user-123",
        anilistId: 777777,
        status: "watching",
        progress: 14,
        score: 9,
        startedAt: "2026-01-01",
        completedAt: null,
        notes: "Loved episode 12",
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-15T00:00:00Z",
      };

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        circuitBreaker,
        kitsuFetch: emptyKitsu(),
      });

      const resolved = await catalog.getAnimeByIds([entry.anilistId]);
      const item = {
        entry,
        anime: resolved.data.get(entry.anilistId) ?? null,
        watchedEpisodes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      };

      expect(resolved.meta.provider).toBe("unavailable");
      expect(item.anime).toBeNull();
      expect(item.entry.progress).toBe(14);
      expect(item.entry.score).toBe(9);
      expect(item.entry.status).toBe("watching");
      expect(item.entry.notes).toBe("Loved episode 12");
      expect(item.entry.completedAt).toBeNull();
      expect(item.watchedEpisodes).toHaveLength(14);
    });

    it("does not backfill genuinely missing IDs from stale cache while AniList is healthy", async () => {
      let now = 1_000_000;
      const cache = createTestCache({ now: () => now });
      cache.putSummary(makeSummary(2));
      now += 13 * HOUR; // stale but still retained

      const fetchMock = vi.fn(async () => anilistPageResponse([1]));
      const { catalog } = createCatalog({
        cache,
        fetchImpl: fetchMock,
        now: () => now,
      });

      const result = await catalog.getAnimeByIds([1, 2]);

      expect(result.data.get(1)?.id).toBe(1);
      // AniList answered successfully, so ID 2 is genuinely missing.
      expect(result.data.has(2)).toBe(false);
      expect(result.meta.provider).toBe("anilist");
      expect(result.meta.stale).toBe(false);
    });

    it("reports the primary provider for a healthy, genuinely empty batch", async () => {
      const fetchMock = vi.fn(async () => anilistPageResponse([]));

      const { catalog } = createCatalog({ fetchImpl: fetchMock });

      const result = await catalog.getAnimeByIds([123]);

      expect(result.data.size).toBe(0);
      expect(result.meta.provider).toBe("anilist");
      expect(result.meta.degraded).toBe(false);
    });

    it("bounds Kitsu fallback fan-out and caches negative mappings", async () => {
      const ids = [10, 11, 12, 13, 14, 15, 16, 17];
      const kitsuFetch = emptyKitsu();
      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache: createTestCache(),
        circuitBreaker,
        kitsuFetch,
      });

      const first = await catalog.getAnimeByIds(ids);
      expect(first.data.size).toBe(0);
      expect(kitsuFetch).toHaveBeenCalledTimes(ids.length);

      // Known-missing mappings are negatively cached for ten minutes.
      const second = await catalog.getAnimeByIds(ids);
      expect(second.data.size).toBe(0);
      expect(kitsuFetch).toHaveBeenCalledTimes(ids.length);
    });

    it("serves known episode totals from stale cache for episode tracking", async () => {
      let now = 1_000_000;
      const cache = createTestCache({ now: () => now });
      cache.putSummary(makeSummary(154587, { episodes: 28 }));
      now += 13 * HOUR;

      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({
        cache,
        circuitBreaker,
        now: () => now,
      });

      const result = await catalog.getAnimeById(154587);
      expect(result.data?.episodes).toBe(28);
      expect(result.meta.stale).toBe(true);
    });
  });

  describe("Airing schedule", () => {
    it("reports unavailability instead of an empty schedule", async () => {
      const circuitBreaker = new CircuitBreaker();
      circuitBreaker.trip();

      const { catalog } = createCatalog({ circuitBreaker });

      await expect(
        catalog.getAiringSchedule({ airingAtGreater: 0, airingAtLesser: 100 }),
      ).rejects.toBeInstanceOf(CatalogUnavailableError);
      expect(catalog.getHealth().circuitBreakerState).toBe("OPEN");
    });

    it("returns schedule entries when AniList is healthy", async () => {
      const fetchMock = vi.fn(async () =>
        jsonResponse({
          data: {
            Page: {
              pageInfo: { hasNextPage: false },
              airingSchedules: [],
            },
          },
        }),
      );

      const { catalog } = createCatalog({ fetchImpl: fetchMock });

      const result = await catalog.getAiringSchedule({
        airingAtGreater: 0,
        airingAtLesser: 100,
      });

      expect(result.data).toEqual([]);
      expect(result.meta.provider).toBe("anilist");
      expect(result.meta.degraded).toBe(false);
    });
  });

  describe("Failure diagnostics", () => {
    it("clears the confirmed-suspension flag after a healthy response", async () => {
      let now = 0;
      const circuitBreaker = new CircuitBreaker({
        cooldownMs: 1000,
        failureThreshold: 1,
        now: () => now,
      });
      let calls = 0;
      const fetchMock = vi.fn(async () => {
        calls += 1;
        return calls === 1 ? suspensionResponse() : anilistDetailsResponse(1);
      });

      const { catalog } = createCatalog({
        circuitBreaker,
        fetchImpl: fetchMock,
        kitsuFetch: emptyKitsu(),
        now: () => now,
      });

      await expect(catalog.getAnimeById(1)).rejects.toBeInstanceOf(
        CatalogUnavailableError,
      );
      expect(catalog.getHealth().isSuspended).toBe(true);

      // After the cooldown, a healthy probe confirms recovery.
      now += 1000;
      const result = await catalog.getAnimeById(1);

      expect(result.data?.id).toBe(1);
      expect(result.meta.provider).toBe("anilist");
      expect(catalog.getHealth().isSuspended).toBe(false);
      expect(catalog.getHealth().circuitBreakerState).toBe("CLOSED");
    });
  });
});
